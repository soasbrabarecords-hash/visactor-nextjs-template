"""Supabase Data API persistence for stateless production runtimes.

The adapter deliberately keeps credentials in request headers only. Atomic or
concurrency-sensitive mutations are delegated to PostgreSQL functions so an
HTTP retry can never leave half an impression or promote two active models.
"""

from __future__ import annotations

import hashlib
import json
import socket
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Mapping, Optional, Protocol, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from .domain import (
    DomainError,
    NotFoundError,
    RankRequest,
    RankedItem,
    isoformat,
    parse_datetime,
    utc_now,
)
from .store import FeedbackResult, StoredModel


SCHEMA_VERSION = 1
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})

REQUESTS_TABLE = "playlist_ai_recommendation_requests"
ITEMS_TABLE = "playlist_ai_recommendation_items"
FEEDBACK_TABLE = "playlist_ai_feedback_events"
MODELS_TABLE = "playlist_ai_model_registry"
MAINTENANCE_TABLE = "playlist_ai_maintenance_runs"

ENSURE_BASELINE_RPC = "playlist_ai_ensure_baseline"
SAVE_IMPRESSION_RPC = "playlist_ai_save_impression"
RECORD_FEEDBACK_RPC = "playlist_ai_record_feedback"
FEEDBACK_ROWS_RPC = "playlist_ai_feedback_rows"
LIST_WORKSPACES_RPC = "playlist_ai_list_workspaces"
PROMOTE_MODEL_RPC = "playlist_ai_promote_model"
START_MAINTENANCE_RPC = "playlist_ai_start_maintenance"
SCHEMA_VERSION_RPC = "playlist_ai_agent_schema_version"


class SupabaseStoreError(RuntimeError):
    """Base error that is safe to expose to server logs."""


class SupabaseConfigurationError(SupabaseStoreError):
    """Raised before network access when production storage is misconfigured."""


class SupabaseTransportError(SupabaseStoreError):
    """Raised when the Data API could not be reached."""


class SupabaseContractError(SupabaseStoreError):
    """Raised when the deployed SQL contract does not match the adapter."""


class SupabaseDataApiError(SupabaseStoreError):
    """Structured non-2xx response without headers or credentials."""

    def __init__(self, status: int, code: str, message: str) -> None:
        self.status = int(status)
        self.code = str(code)[:80]
        self.message = str(message).replace("\n", " ")[:300]
        super().__init__(
            "Supabase Data API rejected the request "
            "(status=%d, code=%s): %s"
            % (self.status, self.code or "unknown", self.message)
        )


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: bytes = b""
    headers: Mapping[str, str] = field(default_factory=dict)


class HttpTransport(Protocol):
    def request(
        self,
        *,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Optional[bytes],
        timeout_seconds: float,
    ) -> HttpResponse:
        ...


class UrllibHttpTransport:
    """Small standard-library transport with bounded response buffering."""

    @staticmethod
    def _read_bounded(response: Any) -> bytes:
        payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise SupabaseTransportError("Supabase Data API response is too large")
        return payload

    def request(
        self,
        *,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Optional[bytes],
        timeout_seconds: float,
    ) -> HttpResponse:
        request = Request(
            url=url,
            data=body,
            headers=dict(headers),
            method=method,
        )
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                return HttpResponse(
                    status=int(response.getcode()),
                    body=self._read_bounded(response),
                    headers=dict(response.headers.items()),
                )
        except HTTPError as exc:
            return HttpResponse(
                status=int(exc.code),
                body=self._read_bounded(exc),
                headers=dict(exc.headers.items()) if exc.headers else {},
            )
        except (URLError, TimeoutError, socket.timeout, OSError) as exc:
            raise SupabaseTransportError(
                "Supabase Data API request could not be completed"
            ) from exc


_MISSING = object()


def _canonical_json(value: Any) -> str:
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise SupabaseContractError("value is not valid JSON") from exc


def _json_object(value: Any, *, field_name: str) -> Dict[str, Any]:
    if value is None or value == "":
        return {}
    if isinstance(value, Mapping):
        return dict(value)
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except json.JSONDecodeError as exc:
            raise SupabaseContractError(
                "%s is not valid JSON" % field_name
            ) from exc
        if isinstance(decoded, Mapping):
            return dict(decoded)
    raise SupabaseContractError("%s must be a JSON object" % field_name)


def _json_text(value: Any, *, field_name: str) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (Mapping, list)):
        return _canonical_json(value)
    raise SupabaseContractError("%s must contain JSON" % field_name)


class SupabaseDataApiStore:
    """AgentStore implementation backed by PostgREST and audited RPCs."""

    def __init__(
        self,
        base_url: str,
        server_key: str,
        *,
        transport: Optional[HttpTransport] = None,
        timeout_seconds: float = 8.0,
        max_attempts: int = 3,
        page_size: int = 500,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self._api_root = self._validated_api_root(base_url)
        key = server_key.strip()
        if not key:
            raise SupabaseConfigurationError(
                "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required "
                "for Supabase persistence"
            )
        if key.startswith("sb_publishable_"):
            raise SupabaseConfigurationError(
                "Supabase persistence requires a server-only secret key"
            )
        self._server_key = key
        self._uses_opaque_secret_key = key.startswith("sb_secret_")
        self._transport = transport or UrllibHttpTransport()
        self._timeout_seconds = max(1.0, min(30.0, float(timeout_seconds)))
        self._max_attempts = max(1, min(4, int(max_attempts)))
        self._page_size = max(50, min(1000, int(page_size)))
        self._sleeper = sleeper

    @staticmethod
    def _validated_api_root(base_url: str) -> str:
        raw = base_url.strip().rstrip("/")
        if not raw:
            raise SupabaseConfigurationError(
                "NEXT_PUBLIC_SUPABASE_URL is required for Supabase persistence"
            )
        parsed = urlsplit(raw)
        is_local_http = parsed.scheme == "http" and parsed.hostname in {
            "127.0.0.1",
            "localhost",
            "::1",
        }
        if (
            (parsed.scheme != "https" and not is_local_http)
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise SupabaseConfigurationError(
                "NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase origin"
            )
        normalized_path = parsed.path.rstrip("/")
        origin = urlunsplit(
            (parsed.scheme, parsed.netloc, normalized_path, "", "")
        ).rstrip("/")
        return origin + "/rest/v1"

    def _url(self, path: str, params: Optional[Mapping[str, Any]]) -> str:
        url = self._api_root + "/" + path.lstrip("/")
        if params:
            pairs = [
                (str(key), str(value))
                for key, value in params.items()
                if value is not None
            ]
            if pairs:
                url += "?" + urlencode(pairs)
        return url

    def _headers(
        self,
        *,
        has_body: bool,
        prefer: Optional[str],
    ) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Accept-Profile": "public",
            "apikey": self._server_key,
            "User-Agent": "playlists-ai-agent/0.1.0",
        }
        # New sb_secret_* keys are opaque API keys, not JWTs. Supabase expects
        # them only in `apikey`; legacy service_role JWTs must also be sent as
        # the bearer token so PostgREST assumes the elevated database role.
        if not self._uses_opaque_secret_key:
            headers["Authorization"] = "Bearer " + self._server_key
        if has_body:
            headers["Content-Type"] = "application/json"
            headers["Content-Profile"] = "public"
        if prefer:
            headers["Prefer"] = prefer
        return headers

    @staticmethod
    def _error_from_response(response: HttpResponse) -> SupabaseDataApiError:
        if response.status in {401, 403}:
            return SupabaseDataApiError(
                response.status,
                "authorization_rejected",
                "Supabase Data API authorization was rejected",
            )
        code = "http_%d" % response.status
        message = "Supabase Data API request failed"
        if response.body:
            try:
                payload = json.loads(response.body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                payload = None
            if isinstance(payload, Mapping):
                raw_code = payload.get("code")
                raw_message = payload.get("message")
                if isinstance(raw_code, str) and raw_code:
                    code = raw_code
                if isinstance(raw_message, str) and raw_message:
                    message = raw_message
        return SupabaseDataApiError(response.status, code, message)

    @staticmethod
    def _decode_success(response: HttpResponse, *, allow_empty: bool) -> Any:
        if not response.body or not response.body.strip():
            if allow_empty:
                return None
            raise SupabaseContractError(
                "Supabase Data API returned an empty success response"
            )
        try:
            return json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SupabaseContractError(
                "Supabase Data API returned invalid JSON"
            ) from exc

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        payload: Any = _MISSING,
        prefer: Optional[str] = None,
        retryable: bool = False,
        allow_empty: bool = False,
    ) -> Any:
        has_body = payload is not _MISSING
        body = (
            _canonical_json(payload).encode("utf-8") if has_body else None
        )
        attempts = self._max_attempts if retryable else 1
        last_transport_error: Optional[SupabaseTransportError] = None
        for attempt in range(attempts):
            try:
                response = self._transport.request(
                    method=method,
                    url=self._url(path, params),
                    headers=self._headers(has_body=has_body, prefer=prefer),
                    body=body,
                    timeout_seconds=self._timeout_seconds,
                )
            except (SupabaseTransportError, TimeoutError, OSError) as exc:
                last_transport_error = (
                    exc
                    if isinstance(exc, SupabaseTransportError)
                    else SupabaseTransportError(
                        "Supabase Data API request could not be completed"
                    )
                )
                if attempt + 1 >= attempts:
                    raise last_transport_error from exc
                self._sleeper(0.1 * (2**attempt))
                continue

            if 200 <= response.status < 300:
                return self._decode_success(response, allow_empty=allow_empty)
            if (
                retryable
                and response.status in RETRYABLE_STATUSES
                and attempt + 1 < attempts
            ):
                self._sleeper(0.1 * (2**attempt))
                continue
            raise self._error_from_response(response)

        if last_transport_error is not None:
            raise last_transport_error
        raise SupabaseTransportError("Supabase Data API request failed")

    def _rpc(
        self,
        name: str,
        payload: Mapping[str, Any],
        *,
        retryable: bool = False,
        allow_empty: bool = False,
    ) -> Any:
        return self._request_json(
            "POST",
            "rpc/" + name,
            payload=dict(payload),
            retryable=retryable,
            allow_empty=allow_empty,
        )

    @staticmethod
    def _rows(payload: Any, *, operation: str) -> List[Dict[str, Any]]:
        if payload is None:
            return []
        if isinstance(payload, Mapping):
            return [dict(payload)]
        if isinstance(payload, list) and all(
            isinstance(row, Mapping) for row in payload
        ):
            return [dict(row) for row in payload]
        raise SupabaseContractError(
            "%s returned an unexpected row shape" % operation
        )

    @classmethod
    def _single_row(cls, payload: Any, *, operation: str) -> Dict[str, Any]:
        rows = cls._rows(payload, operation=operation)
        if len(rows) != 1:
            raise SupabaseContractError(
                "%s must return exactly one row" % operation
            )
        return rows[0]

    @staticmethod
    def _stored_model(row: Mapping[str, Any]) -> StoredModel:
        required = (
            "workspace_id",
            "version",
            "kind",
            "status",
            "artifact_json",
            "created_at",
        )
        if any(row.get(field) is None for field in required):
            raise SupabaseContractError("model row is missing required fields")
        return StoredModel(
            workspace_id=str(row["workspace_id"]),
            version=str(row["version"]),
            kind=str(row["kind"]),
            status=str(row["status"]),
            artifact_json=_json_text(
                row["artifact_json"], field_name="artifact_json"
            ),
            metrics=_json_object(
                row.get("metrics_json"), field_name="metrics_json"
            ),
            training_start=(
                parse_datetime(row["training_start"])
                if row.get("training_start")
                else None
            ),
            training_end=(
                parse_datetime(row["training_end"])
                if row.get("training_end")
                else None
            ),
            created_at=parse_datetime(row["created_at"]),
            promoted_at=(
                parse_datetime(row["promoted_at"])
                if row.get("promoted_at")
                else None
            ),
        )

    @staticmethod
    def _maintenance_row(row: Mapping[str, Any]) -> Dict[str, Any]:
        result = dict(row)
        result["promoted"] = bool(result.get("promoted"))
        result["guardrails"] = _json_object(
            result.pop("guardrails_json", None), field_name="guardrails_json"
        )
        result["metrics"] = _json_object(
            result.pop("metrics_json", None), field_name="metrics_json"
        )
        return result

    def health(self) -> Dict[str, Any]:
        try:
            deployed_version = self._rpc(
                SCHEMA_VERSION_RPC,
                {},
                retryable=True,
            )
            if deployed_version != SCHEMA_VERSION:
                raise SupabaseContractError(
                    "deployed Playlist AI schema version does not match the service"
                )
            self._request_json(
                "GET",
                MODELS_TABLE,
                params={"select": "version", "limit": 1},
                retryable=True,
            )
            ok = True
        except SupabaseStoreError:
            ok = False
        return {
            "ok": ok,
            "backend": "supabase_data_api",
            "schema_version": SCHEMA_VERSION,
        }

    def ensure_baseline(self, workspace_id: str) -> StoredModel:
        payload = self._rpc(
            ENSURE_BASELINE_RPC,
            {"p_workspace_id": workspace_id},
            retryable=True,
        )
        return self._stored_model(
            self._single_row(payload, operation=ENSURE_BASELINE_RPC)
        )

    def get_active_model(self, workspace_id: str) -> Optional[StoredModel]:
        payload = self._request_json(
            "GET",
            MODELS_TABLE,
            params={
                "select": (
                    "workspace_id,version,kind,status,artifact_json,metrics_json,"
                    "training_start,training_end,created_at,promoted_at"
                ),
                "workspace_id": "eq." + workspace_id,
                "status": "eq.active",
                "order": "promoted_at.desc.nullslast",
                "limit": 1,
            },
            retryable=True,
        )
        rows = self._rows(payload, operation="get_active_model")
        return self._stored_model(rows[0]) if rows else None

    def save_impression(
        self,
        request_id: str,
        request: RankRequest,
        result_items: Sequence[RankedItem],
        *,
        model_version: str,
        personalized: bool,
        cold_start: bool,
        context: Mapping[str, Any],
    ) -> None:
        request_payload = {
            "request_id": request_id,
            "workspace_id": request.workspace_id,
            "playlist_id": request.playlist_id,
            "playlist_name": request.playlist_name,
            "genre": request.genre,
            "market": request.market,
            "as_of": isoformat(request.as_of),
            "requested_limit": request.limit,
            "model_version": model_version,
            "personalized": bool(personalized),
            "cold_start": bool(cold_start),
            "context_json": dict(context),
        }
        items_payload = [
            {
                "request_id": request_id,
                "workspace_id": request.workspace_id,
                "track_id": item.track_id,
                "rank": item.rank,
                "score": item.score,
                "base_score": item.base_score,
                "learned_score": item.learned_score,
                "propensity": item.propensity,
                "reason_codes_json": list(item.reason_codes),
                "features_json": dict(item.features),
                "candidate_json": dict(item.candidate_snapshot),
            }
            for item in result_items
        ]
        self._rpc(
            SAVE_IMPRESSION_RPC,
            {"p_request": request_payload, "p_items": items_payload},
            retryable=True,
            allow_empty=True,
        )

    def get_request(
        self, workspace_id: str, request_id: str
    ) -> Optional[Dict[str, Any]]:
        payload = self._request_json(
            "GET",
            REQUESTS_TABLE,
            params={
                "select": "*",
                "workspace_id": "eq." + workspace_id,
                "request_id": "eq." + request_id,
                "limit": 1,
            },
            retryable=True,
        )
        rows = self._rows(payload, operation="get_request")
        return rows[0] if rows else None

    def get_item(
        self, workspace_id: str, request_id: str, track_id: str
    ) -> Optional[Dict[str, Any]]:
        payload = self._request_json(
            "GET",
            ITEMS_TABLE,
            params={
                "select": "*",
                "workspace_id": "eq." + workspace_id,
                "request_id": "eq." + request_id,
                "track_id": "eq." + track_id,
                "limit": 1,
            },
            retryable=True,
        )
        rows = self._rows(payload, operation="get_item")
        return rows[0] if rows else None

    @staticmethod
    def _feedback_error(error: SupabaseDataApiError) -> Exception:
        message = error.message.lower()
        if error.code in {"P0002", "PT404"} or "not found" in message:
            return NotFoundError("recommendation item not found in this workspace")
        if "rate limit" in message:
            return DomainError("feedback rate limit exceeded for this actor")
        if "event_id" in message or error.code == "23505":
            return DomainError("event_id already exists for another feedback event")
        if "earlier" in message:
            return DomainError("occurred_at cannot be earlier than the impression")
        if "future" in message:
            return DomainError(
                "occurred_at cannot be more than five minutes in the future"
            )
        if error.status in {400, 409, 422} or error.code in {
            "P0001",
            "23503",
            "23514",
        }:
            return DomainError("feedback was rejected by the persistence layer")
        return error

    def record_feedback(
        self,
        *,
        workspace_id: str,
        request_id: str,
        track_id: str,
        action: str,
        event_id: Optional[str],
        target_playlist_id: Optional[str],
        actor_id: Optional[str],
        actor_role: Optional[str],
        max_actor_events_per_hour: int,
        occurred_at: datetime,
    ) -> FeedbackResult:
        resolved_target = target_playlist_id.strip() if target_playlist_id else None
        resolved_actor_id = actor_id.strip() if actor_id else None
        resolved_actor_role = actor_role.strip().lower() if actor_role else None
        if resolved_actor_id and len(resolved_actor_id) > 200:
            raise DomainError("actor_id is too long")
        if resolved_actor_role and len(resolved_actor_role) > 80:
            raise DomainError("actor_role is too long")
        if event_id:
            resolved_event_id = event_id.strip()
        else:
            identity = "\x1f".join((workspace_id, request_id, track_id, action))
            resolved_event_id = "auto-" + hashlib.sha256(
                identity.encode("utf-8")
            ).hexdigest()
        if not resolved_event_id or len(resolved_event_id) > 200:
            raise DomainError("event_id is invalid")

        try:
            payload = self._rpc(
                RECORD_FEEDBACK_RPC,
                {
                    "p_workspace_id": workspace_id,
                    "p_request_id": request_id,
                    "p_track_id": track_id,
                    "p_action": action,
                    "p_event_id": resolved_event_id,
                    "p_target_playlist_id": resolved_target,
                    "p_actor_id": resolved_actor_id,
                    "p_actor_role": resolved_actor_role,
                    "p_occurred_at": isoformat(occurred_at),
                    "p_max_actor_events_per_hour": max(
                        1, min(100000, int(max_actor_events_per_hour))
                    ),
                },
                retryable=True,
            )
        except SupabaseDataApiError as exc:
            raise self._feedback_error(exc) from exc

        row = self._single_row(payload, operation=RECORD_FEEDBACK_RPC)
        if (
            not row.get("event_id")
            or row.get("action") is None
            or row.get("occurred_at") is None
            or not isinstance(row.get("created"), bool)
        ):
            raise SupabaseContractError(
                "%s returned an incomplete row" % RECORD_FEEDBACK_RPC
            )
        return FeedbackResult(
            event_id=str(row["event_id"]),
            created=bool(row["created"]),
            action=str(row["action"]),
            occurred_at=parse_datetime(row["occurred_at"]),
        )

    @staticmethod
    def _training_row(row: Mapping[str, Any]) -> Dict[str, Any]:
        result = dict(row)
        required = (
            "event_id",
            "request_id",
            "track_id",
            "action",
            "server_created_at",
            "impression_playlist_id",
            "features_json",
            "base_score",
            "propensity",
        )
        if any(result.get(field) is None for field in required):
            raise SupabaseContractError(
                "%s returned an incomplete training row" % FEEDBACK_ROWS_RPC
            )
        result["features_json"] = _json_text(
            result["features_json"], field_name="features_json"
        )
        return result

    def feedback_rows(
        self, workspace_id: str, *, limit: int = 50000
    ) -> List[Dict[str, Any]]:
        remaining = max(1, min(100000, int(limit)))
        collected: List[Dict[str, Any]] = []
        before_created_at: Optional[str] = None
        before_event_id: Optional[str] = None
        while remaining > 0:
            page_size = min(self._page_size, remaining)
            payload = self._rpc(
                FEEDBACK_ROWS_RPC,
                {
                    "p_workspace_id": workspace_id,
                    "p_page_size": page_size,
                    "p_before_created_at": before_created_at,
                    "p_before_event_id": before_event_id,
                },
                retryable=True,
            )
            raw_rows = self._rows(payload, operation=FEEDBACK_ROWS_RPC)
            if len(raw_rows) > page_size:
                raise SupabaseContractError(
                    "%s exceeded the requested page size" % FEEDBACK_ROWS_RPC
                )
            page = [self._training_row(row) for row in raw_rows]
            if not page:
                break
            collected.extend(page)
            remaining -= len(page)
            if len(page) < page_size or remaining <= 0:
                break
            last = page[-1]
            next_created_at = str(last["server_created_at"])
            next_event_id = str(last["event_id"])
            if (
                next_created_at == before_created_at
                and next_event_id == before_event_id
            ):
                raise SupabaseContractError(
                    "%s cursor did not advance" % FEEDBACK_ROWS_RPC
                )
            before_created_at = next_created_at
            before_event_id = next_event_id
        return list(reversed(collected))

    def list_workspaces(self, *, limit: int = 100) -> List[str]:
        bounded_limit = max(1, min(1000, int(limit)))
        payload = self._rpc(
            LIST_WORKSPACES_RPC,
            {"p_limit": bounded_limit},
            retryable=True,
        )
        rows = self._rows(payload, operation=LIST_WORKSPACES_RPC)
        result: List[str] = []
        for row in rows[:bounded_limit]:
            workspace_id = row.get("workspace_id")
            if not isinstance(workspace_id, str) or not workspace_id:
                raise SupabaseContractError(
                    "%s returned an invalid workspace" % LIST_WORKSPACES_RPC
                )
            result.append(workspace_id)
        return result

    def register_candidate(
        self,
        *,
        workspace_id: str,
        version: str,
        artifact_json: str,
        metrics: Mapping[str, Any],
        training_start: Optional[datetime],
        training_end: Optional[datetime],
        status: str = "candidate",
    ) -> None:
        self._request_json(
            "POST",
            MODELS_TABLE,
            payload={
                "workspace_id": workspace_id,
                "version": version,
                "kind": "logistic",
                "status": status,
                "artifact_json": artifact_json,
                "metrics_json": dict(metrics),
                "training_start": (
                    isoformat(training_start) if training_start else None
                ),
                "training_end": isoformat(training_end) if training_end else None,
            },
            prefer="return=minimal",
            allow_empty=True,
        )

    def promote_model(self, workspace_id: str, version: str) -> None:
        try:
            self._rpc(
                PROMOTE_MODEL_RPC,
                {"p_workspace_id": workspace_id, "p_version": version},
                allow_empty=True,
            )
        except SupabaseDataApiError as exc:
            if exc.code in {"P0002", "PT404"} or "not found" in exc.message.lower():
                raise NotFoundError("candidate model not found") from exc
            raise

    def reject_model(self, workspace_id: str, version: str) -> None:
        payload = self._request_json(
            "PATCH",
            MODELS_TABLE,
            params={
                "workspace_id": "eq." + workspace_id,
                "version": "eq." + version,
                "status": "eq.candidate",
            },
            payload={"status": "rejected"},
            prefer="return=representation",
        )
        rows = self._rows(payload, operation="reject_model")
        if len(rows) != 1:
            raise NotFoundError("candidate model not found")

    def start_maintenance(self, workspace_id: str, trigger_name: str) -> str:
        run_id = str(uuid.uuid4())
        try:
            payload = self._rpc(
                START_MAINTENANCE_RPC,
                {
                    "p_run_id": run_id,
                    "p_workspace_id": workspace_id,
                    "p_trigger_name": trigger_name,
                },
            )
        except SupabaseDataApiError as exc:
            if (
                exc.status in {400, 409, 422}
                and "maintenance" in exc.message.lower()
            ):
                raise DomainError("maintenance is already running") from exc
            raise
        row = self._single_row(payload, operation=START_MAINTENANCE_RPC)
        returned_run_id = row.get("run_id")
        if str(returned_run_id) != run_id:
            raise SupabaseContractError(
                "%s returned the wrong run_id" % START_MAINTENANCE_RPC
            )
        return run_id

    def finish_maintenance(
        self,
        run_id: str,
        *,
        status: str,
        examples_count: int = 0,
        candidate_version: Optional[str] = None,
        promoted: bool = False,
        guardrails: Optional[Mapping[str, Any]] = None,
        metrics: Optional[Mapping[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = self._request_json(
            "PATCH",
            MAINTENANCE_TABLE,
            params={"run_id": "eq." + run_id},
            payload={
                "status": status,
                "finished_at": isoformat(utc_now()),
                "examples_count": max(0, int(examples_count)),
                "candidate_version": candidate_version,
                "promoted": bool(promoted),
                "guardrails_json": dict(guardrails or {}),
                "metrics_json": dict(metrics or {}),
                "error_message": error_message,
            },
            prefer="return=representation",
        )
        row = self._single_row(payload, operation="finish_maintenance")
        return self._maintenance_row(row)

    def get_maintenance_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        payload = self._request_json(
            "GET",
            MAINTENANCE_TABLE,
            params={"select": "*", "run_id": "eq." + run_id, "limit": 1},
            retryable=True,
        )
        rows = self._rows(payload, operation="get_maintenance_run")
        return self._maintenance_row(rows[0]) if rows else None
