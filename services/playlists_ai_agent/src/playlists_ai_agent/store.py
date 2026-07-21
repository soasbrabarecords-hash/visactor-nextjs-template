"""Persistence contracts and SQLite implementation for the learning agent."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Protocol, Sequence, Tuple

from .domain import (
    DomainError,
    NotFoundError,
    RankRequest,
    RankedItem,
    isoformat,
    parse_datetime,
    utc_now,
)


SCHEMA_VERSION = 1


@dataclass(frozen=True)
class StoredModel:
    workspace_id: str
    version: str
    kind: str
    status: str
    artifact_json: str
    metrics: Dict[str, Any]
    training_start: Optional[datetime]
    training_end: Optional[datetime]
    created_at: datetime
    promoted_at: Optional[datetime]


@dataclass(frozen=True)
class FeedbackResult:
    event_id: str
    created: bool
    action: str
    occurred_at: datetime


class AgentStore(Protocol):
    """Storage boundary shared by local SQLite and production adapters."""

    def health(self) -> Dict[str, Any]:
        ...

    def ensure_baseline(self, workspace_id: str) -> StoredModel:
        ...

    def get_active_model(self, workspace_id: str) -> Optional[StoredModel]:
        ...

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
        ...

    def get_request(
        self, workspace_id: str, request_id: str
    ) -> Optional[Dict[str, Any]]:
        ...

    def get_item(
        self, workspace_id: str, request_id: str, track_id: str
    ) -> Optional[Dict[str, Any]]:
        ...

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
        ...

    def feedback_rows(
        self, workspace_id: str, *, limit: int = 50000
    ) -> List[Dict[str, Any]]:
        ...

    def list_workspaces(self, *, limit: int = 100) -> List[str]:
        ...

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
        ...

    def promote_model(self, workspace_id: str, version: str) -> None:
        ...

    def reject_model(self, workspace_id: str, version: str) -> None:
        ...

    def start_maintenance(self, workspace_id: str, trigger_name: str) -> str:
        ...

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
        ...

    def get_maintenance_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        ...


class SQLiteStore:
    """Thread-safe SQLite store using one connection and explicit tenant keys."""

    def __init__(self, path: str) -> None:
        self.path = path
        if path != ":memory:":
            Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(
            path,
            check_same_thread=False,
            isolation_level="DEFERRED",
            timeout=10.0,
        )
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self._initialize()

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def _initialize(self) -> None:
        schema = """
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 10000;

        CREATE TABLE IF NOT EXISTS schema_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recommendation_requests (
          request_id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          playlist_id TEXT NOT NULL,
          playlist_name TEXT NOT NULL,
          genre TEXT NOT NULL,
          market TEXT NOT NULL,
          as_of TEXT NOT NULL,
          requested_limit INTEGER NOT NULL,
          model_version TEXT NOT NULL,
          personalized INTEGER NOT NULL,
          cold_start INTEGER NOT NULL,
          context_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS recommendation_requests_workspace_created_idx
          ON recommendation_requests (workspace_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS recommendation_items (
          request_id TEXT NOT NULL REFERENCES recommendation_requests(request_id),
          workspace_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          rank INTEGER NOT NULL,
          score REAL NOT NULL,
          base_score REAL NOT NULL,
          learned_score REAL,
          propensity REAL NOT NULL,
          reason_codes_json TEXT NOT NULL,
          features_json TEXT NOT NULL,
          candidate_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (request_id, track_id)
        );

        CREATE INDEX IF NOT EXISTS recommendation_items_workspace_track_idx
          ON recommendation_items (workspace_id, track_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS feedback_events (
          event_id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          action TEXT NOT NULL,
          target_playlist_id TEXT,
          actor_id TEXT,
          actor_role TEXT,
          occurred_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (request_id, track_id)
            REFERENCES recommendation_items (request_id, track_id)
        );

        CREATE INDEX IF NOT EXISTS feedback_events_workspace_time_idx
          ON feedback_events (workspace_id, occurred_at, event_id);

        CREATE INDEX IF NOT EXISTS feedback_events_actor_rate_idx
          ON feedback_events (workspace_id, actor_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS model_registry (
          workspace_id TEXT NOT NULL,
          version TEXT NOT NULL,
          kind TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('candidate', 'active', 'retired', 'rejected')),
          artifact_json TEXT NOT NULL,
          metrics_json TEXT NOT NULL,
          training_start TEXT,
          training_end TEXT,
          created_at TEXT NOT NULL,
          promoted_at TEXT,
          PRIMARY KEY (workspace_id, version)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS model_registry_one_active_idx
          ON model_registry (workspace_id)
          WHERE status = 'active';

        CREATE TABLE IF NOT EXISTS maintenance_runs (
          run_id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          trigger_name TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          examples_count INTEGER NOT NULL DEFAULT 0,
          candidate_version TEXT,
          promoted INTEGER NOT NULL DEFAULT 0,
          guardrails_json TEXT NOT NULL DEFAULT '{}',
          metrics_json TEXT NOT NULL DEFAULT '{}',
          error_message TEXT
        );

        CREATE INDEX IF NOT EXISTS maintenance_runs_workspace_started_idx
          ON maintenance_runs (workspace_id, started_at DESC);

        CREATE TRIGGER IF NOT EXISTS recommendation_requests_no_update
        BEFORE UPDATE ON recommendation_requests
        BEGIN SELECT RAISE(ABORT, 'recommendation requests are immutable'); END;

        CREATE TRIGGER IF NOT EXISTS recommendation_requests_no_delete
        BEFORE DELETE ON recommendation_requests
        BEGIN SELECT RAISE(ABORT, 'recommendation requests are immutable'); END;

        CREATE TRIGGER IF NOT EXISTS recommendation_items_no_update
        BEFORE UPDATE ON recommendation_items
        BEGIN SELECT RAISE(ABORT, 'recommendation items are immutable'); END;

        CREATE TRIGGER IF NOT EXISTS recommendation_items_no_delete
        BEFORE DELETE ON recommendation_items
        BEGIN SELECT RAISE(ABORT, 'recommendation items are immutable'); END;
        """
        with self._lock:
            try:
                self._connection.execute("PRAGMA journal_mode = WAL")
            except sqlite3.DatabaseError:
                pass
            self._connection.executescript(schema)
            self._connection.execute(
                "INSERT OR REPLACE INTO schema_metadata(key, value) VALUES('version', ?)",
                (str(SCHEMA_VERSION),),
            )
            self._connection.commit()

    def health(self) -> Dict[str, Any]:
        with self._lock:
            row = self._connection.execute("SELECT 1 AS ok").fetchone()
        return {"ok": bool(row and row["ok"] == 1), "backend": "sqlite", "schema_version": SCHEMA_VERSION}

    def ensure_baseline(self, workspace_id: str) -> StoredModel:
        active = self.get_active_model(workspace_id)
        if active:
            return active
        now = isoformat(utc_now())
        with self._lock, self._connection:
            try:
                self._connection.execute(
                    """
                    INSERT INTO model_registry(
                      workspace_id, version, kind, status, artifact_json,
                      metrics_json, created_at, promoted_at
                    ) VALUES (?, 'baseline-v1', 'baseline', 'active', '{}', '{}', ?, ?)
                    """,
                    (workspace_id, now, now),
                )
            except sqlite3.IntegrityError:
                pass
        active = self.get_active_model(workspace_id)
        if active is None:
            raise RuntimeError("could not initialize baseline model")
        return active

    def get_active_model(self, workspace_id: str) -> Optional[StoredModel]:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT * FROM model_registry
                WHERE workspace_id = ? AND status = 'active'
                ORDER BY promoted_at DESC LIMIT 1
                """,
                (workspace_id,),
            ).fetchone()
        return self._stored_model(row) if row else None

    @staticmethod
    def _stored_model(row: sqlite3.Row) -> StoredModel:
        return StoredModel(
            workspace_id=row["workspace_id"],
            version=row["version"],
            kind=row["kind"],
            status=row["status"],
            artifact_json=row["artifact_json"],
            metrics=json.loads(row["metrics_json"] or "{}"),
            training_start=parse_datetime(row["training_start"])
            if row["training_start"]
            else None,
            training_end=parse_datetime(row["training_end"])
            if row["training_end"]
            else None,
            created_at=parse_datetime(row["created_at"]),
            promoted_at=parse_datetime(row["promoted_at"]) if row["promoted_at"] else None,
        )

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
        created_at = isoformat(utc_now())
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO recommendation_requests(
                  request_id, workspace_id, playlist_id, playlist_name, genre,
                  market, as_of, requested_limit, model_version, personalized,
                  cold_start, context_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    request_id,
                    request.workspace_id,
                    request.playlist_id,
                    request.playlist_name,
                    request.genre,
                    request.market,
                    isoformat(request.as_of),
                    request.limit,
                    model_version,
                    int(personalized),
                    int(cold_start),
                    json.dumps(dict(context), sort_keys=True, separators=(",", ":")),
                    created_at,
                ),
            )
            self._connection.executemany(
                """
                INSERT INTO recommendation_items(
                  request_id, workspace_id, track_id, rank, score, base_score,
                  learned_score, propensity, reason_codes_json, features_json,
                  candidate_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        request_id,
                        request.workspace_id,
                        item.track_id,
                        item.rank,
                        item.score,
                        item.base_score,
                        item.learned_score,
                        item.propensity,
                        json.dumps(list(item.reason_codes), separators=(",", ":")),
                        json.dumps(item.features, sort_keys=True, separators=(",", ":")),
                        json.dumps(item.candidate_snapshot, sort_keys=True, separators=(",", ":")),
                        created_at,
                    )
                    for item in result_items
                ],
            )

    def get_request(self, workspace_id: str, request_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM recommendation_requests WHERE workspace_id = ? AND request_id = ?",
                (workspace_id, request_id),
            ).fetchone()
        return dict(row) if row else None

    def get_item(self, workspace_id: str, request_id: str, track_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT * FROM recommendation_items
                WHERE workspace_id = ? AND request_id = ? AND track_id = ?
                """,
                (workspace_id, request_id, track_id),
            ).fetchone()
        return dict(row) if row else None

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
        request = self.get_request(workspace_id, request_id)
        item = self.get_item(workspace_id, request_id, track_id)
        if request is None or item is None:
            raise NotFoundError("recommendation item not found in this workspace")

        impression_created_at = parse_datetime(request["created_at"])
        now = utc_now()
        if occurred_at < impression_created_at - timedelta(minutes=5):
            raise DomainError("occurred_at cannot be earlier than the impression")
        if occurred_at > now + timedelta(minutes=5):
            raise DomainError("occurred_at cannot be more than five minutes in the future")

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
            resolved_event_id = "auto-" + hashlib.sha256(identity.encode("utf-8")).hexdigest()
        if not resolved_event_id or len(resolved_event_id) > 200:
            raise DomainError("event_id is invalid")

        now = isoformat(utc_now())
        with self._lock, self._connection:
            existing = self._connection.execute(
                """
                SELECT workspace_id, request_id, track_id, action,
                       target_playlist_id, actor_id, actor_role, occurred_at
                FROM feedback_events WHERE event_id = ?
                """,
                (resolved_event_id,),
            ).fetchone()
            if existing is not None:
                identity_matches = (
                    existing["workspace_id"] == workspace_id
                    and existing["request_id"] == request_id
                    and existing["track_id"] == track_id
                    and existing["action"] == action
                    and existing["target_playlist_id"] == resolved_target
                    and existing["actor_id"] == resolved_actor_id
                    and existing["actor_role"] == resolved_actor_role
                )
                if not identity_matches:
                    raise DomainError(
                        "event_id already exists for another feedback event"
                    )
                return FeedbackResult(
                    event_id=resolved_event_id,
                    created=False,
                    action=existing["action"],
                    occurred_at=parse_datetime(existing["occurred_at"]),
                )
            if resolved_actor_id:
                window_start = isoformat(utc_now() - timedelta(hours=1))
                count_row = self._connection.execute(
                    """
                    SELECT COUNT(*) AS count
                    FROM feedback_events
                    WHERE workspace_id = ? AND actor_id = ? AND created_at >= ?
                    """,
                    (workspace_id, resolved_actor_id, window_start),
                ).fetchone()
                if count_row and int(count_row["count"]) >= max_actor_events_per_hour:
                    raise DomainError("feedback rate limit exceeded for this actor")
            cursor = self._connection.execute(
                """
                INSERT INTO feedback_events(
                  event_id, workspace_id, request_id, track_id, action,
                  target_playlist_id, actor_id, actor_role, occurred_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_event_id,
                    workspace_id,
                    request_id,
                    track_id,
                    action,
                    resolved_target,
                    resolved_actor_id,
                    resolved_actor_role,
                    isoformat(occurred_at),
                    now,
                ),
            )
            created = cursor.rowcount == 1
            row = self._connection.execute(
                """
                SELECT workspace_id, request_id, track_id, action,
                       target_playlist_id, actor_id, actor_role, occurred_at
                FROM feedback_events WHERE event_id = ?
                """,
                (resolved_event_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError("feedback event was not persisted")
        identity_matches = (
            row["workspace_id"] == workspace_id
            and row["request_id"] == request_id
            and row["track_id"] == track_id
            and row["action"] == action
            and row["target_playlist_id"] == resolved_target
            and row["actor_id"] == resolved_actor_id
            and row["actor_role"] == resolved_actor_role
        )
        if not identity_matches:
            raise DomainError("event_id already exists for another feedback event")
        return FeedbackResult(
            event_id=resolved_event_id,
            created=created,
            action=row["action"],
            occurred_at=parse_datetime(row["occurred_at"]),
        )

    def feedback_rows(
        self, workspace_id: str, *, limit: int = 50000
    ) -> List[Dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT
                  feedback_events.event_id,
                  feedback_events.request_id,
                  feedback_events.track_id,
                  feedback_events.action,
                  feedback_events.target_playlist_id,
                  feedback_events.occurred_at,
                  feedback_events.created_at AS server_created_at,
                  recommendation_requests.playlist_id AS impression_playlist_id,
                  recommendation_items.features_json,
                  recommendation_items.base_score,
                  recommendation_items.propensity
                FROM feedback_events
                JOIN recommendation_items
                  ON recommendation_items.request_id = feedback_events.request_id
                 AND recommendation_items.track_id = feedback_events.track_id
                JOIN recommendation_requests
                  ON recommendation_requests.request_id = feedback_events.request_id
                WHERE feedback_events.workspace_id = ?
                ORDER BY feedback_events.created_at DESC, feedback_events.event_id DESC
                LIMIT ?
                """,
                (workspace_id, max(1, min(100000, int(limit)))),
            ).fetchall()
        return [dict(row) for row in reversed(rows)]

    def list_workspaces(self, *, limit: int = 100) -> List[str]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT workspace_id, MAX(created_at) AS latest
                FROM recommendation_requests
                GROUP BY workspace_id
                ORDER BY latest DESC
                LIMIT ?
                """,
                (max(1, min(1000, int(limit))),),
            ).fetchall()
        return [str(row["workspace_id"]) for row in rows]

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
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO model_registry(
                  workspace_id, version, kind, status, artifact_json,
                  metrics_json, training_start, training_end, created_at
                ) VALUES (?, ?, 'logistic', ?, ?, ?, ?, ?, ?)
                """,
                (
                    workspace_id,
                    version,
                    status,
                    artifact_json,
                    json.dumps(dict(metrics), sort_keys=True, separators=(",", ":")),
                    isoformat(training_start) if training_start else None,
                    isoformat(training_end) if training_end else None,
                    isoformat(utc_now()),
                ),
            )

    def promote_model(self, workspace_id: str, version: str) -> None:
        now = isoformat(utc_now())
        with self._lock, self._connection:
            row = self._connection.execute(
                """
                SELECT status FROM model_registry
                WHERE workspace_id = ? AND version = ? AND kind = 'logistic'
                """,
                (workspace_id, version),
            ).fetchone()
            if row is None:
                raise NotFoundError("candidate model not found")
            self._connection.execute(
                """
                UPDATE model_registry SET status = 'retired'
                WHERE workspace_id = ? AND status = 'active'
                """,
                (workspace_id,),
            )
            self._connection.execute(
                """
                UPDATE model_registry SET status = 'active', promoted_at = ?
                WHERE workspace_id = ? AND version = ?
                """,
                (now, workspace_id, version),
            )

    def reject_model(self, workspace_id: str, version: str) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                """
                UPDATE model_registry SET status = 'rejected'
                WHERE workspace_id = ? AND version = ? AND status = 'candidate'
                """,
                (workspace_id, version),
            )

    def start_maintenance(self, workspace_id: str, trigger_name: str) -> str:
        run_id = str(uuid.uuid4())
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO maintenance_runs(
                  run_id, workspace_id, trigger_name, status, started_at
                ) VALUES (?, ?, ?, 'running', ?)
                """,
                (run_id, workspace_id, trigger_name, isoformat(utc_now())),
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
        with self._lock, self._connection:
            self._connection.execute(
                """
                UPDATE maintenance_runs
                SET status = ?, finished_at = ?, examples_count = ?,
                    candidate_version = ?, promoted = ?, guardrails_json = ?,
                    metrics_json = ?, error_message = ?
                WHERE run_id = ?
                """,
                (
                    status,
                    isoformat(utc_now()),
                    examples_count,
                    candidate_version,
                    int(promoted),
                    json.dumps(dict(guardrails or {}), sort_keys=True, separators=(",", ":")),
                    json.dumps(dict(metrics or {}), sort_keys=True, separators=(",", ":")),
                    error_message,
                    run_id,
                ),
            )
            row = self._connection.execute(
                "SELECT * FROM maintenance_runs WHERE run_id = ?", (run_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError("maintenance run not found")
        result = dict(row)
        result["promoted"] = bool(result["promoted"])
        result["guardrails"] = json.loads(result.pop("guardrails_json") or "{}")
        result["metrics"] = json.loads(result.pop("metrics_json") or "{}")
        return result

    def get_maintenance_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM maintenance_runs WHERE run_id = ?", (run_id,)
            ).fetchone()
        return dict(row) if row else None
