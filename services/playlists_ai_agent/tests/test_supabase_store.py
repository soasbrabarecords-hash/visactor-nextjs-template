from __future__ import annotations

import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from playlists_ai_agent.domain import (
    Candidate,
    DomainError,
    NotFoundError,
    RankRequest,
    RankedItem,
)
from playlists_ai_agent.service import build_default_store
from playlists_ai_agent.store import SQLiteStore
from playlists_ai_agent.supabase_store import (
    HttpResponse,
    SupabaseConfigurationError,
    SupabaseDataApiError,
    SupabaseDataApiStore,
)


def response(status: int, payload=None) -> HttpResponse:
    body = b"" if payload is None else json.dumps(payload).encode("utf-8")
    return HttpResponse(status=status, body=body)


class QueueTransport:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, **kwargs):
        self.calls.append(kwargs)
        if not self.responses:
            raise AssertionError("unexpected HTTP request")
        result = self.responses.pop(0)
        if callable(result):
            result = result(kwargs)
        if isinstance(result, BaseException):
            raise result
        return result


def model_row(**overrides):
    row = {
        "workspace_id": "workspace-1",
        "version": "baseline-v1",
        "kind": "baseline",
        "status": "active",
        "artifact_json": "{}",
        "metrics_json": {},
        "training_start": None,
        "training_end": None,
        "created_at": "2026-07-21T12:00:00Z",
        "promoted_at": "2026-07-21T12:00:00Z",
    }
    row.update(overrides)
    return row


def request_and_item():
    candidate = Candidate.build(
        track_id="track-1",
        name="Faixa",
        artists="Artista",
        genre="trap",
        market="BR",
    )
    rank_request = RankRequest.build(
        workspace_id="workspace-1",
        playlist_id="playlist-1",
        playlist_name="Trap Agora",
        genre="trap",
        market="BR",
        as_of="2026-07-21T12:00:00Z",
        limit=1,
        candidates=[candidate],
    )
    item = RankedItem(
        track_id="track-1",
        rank=1,
        score=84.0,
        base_score=80.0,
        learned_score=90.0,
        reason_codes=("playlist_fit_high",),
        propensity=0.95,
        features={"bias": 1.0, "fit": 0.9},
        candidate_snapshot=candidate.snapshot(),
    )
    return rank_request, item


class SupabaseDataApiStoreTests(unittest.TestCase):
    def store(self, transport, **kwargs):
        return SupabaseDataApiStore(
            "https://project.supabase.co",
            "service-role-secret",
            transport=transport,
            sleeper=lambda _seconds: None,
            **kwargs,
        )

    def test_configuration_rejects_unsafe_origins_and_empty_key(self) -> None:
        with self.assertRaises(SupabaseConfigurationError):
            SupabaseDataApiStore("http://example.com", "secret")
        with self.assertRaises(SupabaseConfigurationError):
            SupabaseDataApiStore("https://user:pass@example.com", "secret")
        with self.assertRaises(SupabaseConfigurationError):
            SupabaseDataApiStore("https://example.com", "")
        local = SupabaseDataApiStore(
            "http://127.0.0.1:54321", "local-secret", transport=QueueTransport([])
        )
        self.assertIn("127.0.0.1", local._api_root)

    def test_idempotent_rpc_retries_and_never_puts_secret_in_error(self) -> None:
        transport = QueueTransport(
            [
                response(503, {"code": "temporary", "message": "retry"}),
                response(200, [model_row()]),
            ]
        )
        store = self.store(transport, max_attempts=2)
        model = store.ensure_baseline("workspace-1")
        self.assertEqual(model.version, "baseline-v1")
        self.assertEqual(len(transport.calls), 2)
        self.assertEqual(
            transport.calls[0]["headers"]["Authorization"],
            "Bearer service-role-secret",
        )

        denied = self.store(
            QueueTransport(
                [
                    response(
                        401,
                        {
                            "code": "bad_key",
                            "message": "service-role-secret is invalid",
                        },
                    )
                ]
            )
        )
        with self.assertRaises(SupabaseDataApiError) as raised:
            denied.get_active_model("workspace-1")
        self.assertNotIn("service-role-secret", str(raised.exception))

    def test_opaque_secret_key_uses_apikey_header_only(self) -> None:
        transport = QueueTransport([response(200, [])])
        store = SupabaseDataApiStore(
            "https://project.supabase.co",
            "sb_secret_example",
            transport=transport,
        )

        self.assertIsNone(store.get_active_model("workspace-1"))
        self.assertEqual(
            transport.calls[0]["headers"]["apikey"], "sb_secret_example"
        )
        self.assertNotIn("Authorization", transport.calls[0]["headers"])

        with self.assertRaises(SupabaseConfigurationError):
            SupabaseDataApiStore(
                "https://project.supabase.co",
                "sb_publishable_example",
                transport=QueueTransport([]),
            )

    def test_save_impression_uses_one_atomic_rpc_with_json_payloads(self) -> None:
        transport = QueueTransport([response(204)])
        store = self.store(transport)
        rank_request, item = request_and_item()
        store.save_impression(
            "request-1",
            rank_request,
            [item],
            model_version="logistic-v1",
            personalized=True,
            cold_start=False,
            context={"candidate_count": 1},
        )

        self.assertIn(
            "/rest/v1/rpc/playlist_ai_save_impression",
            transport.calls[0]["url"],
        )
        payload = json.loads(transport.calls[0]["body"].decode("utf-8"))
        self.assertEqual(payload["p_request"]["request_id"], "request-1")
        self.assertEqual(payload["p_request"]["context_json"], {"candidate_count": 1})
        self.assertEqual(payload["p_items"][0]["features_json"]["fit"], 0.9)
        self.assertEqual(
            payload["p_items"][0]["reason_codes_json"],
            ["playlist_fit_high"],
        )

    def test_feedback_contract_and_domain_error_mapping(self) -> None:
        created_transport = QueueTransport(
            [
                response(
                    200,
                    [
                        {
                            "event_id": "event-1",
                            "created": True,
                            "action": "save",
                            "occurred_at": "2026-07-21T12:01:00Z",
                        }
                    ],
                )
            ]
        )
        store = self.store(created_transport)
        result = store.record_feedback(
            workspace_id="workspace-1",
            request_id="request-1",
            track_id="track-1",
            action="save",
            event_id="event-1",
            target_playlist_id=None,
            actor_id="user-1",
            actor_role="CURADOR",
            max_actor_events_per_hour=200,
            occurred_at=datetime(2026, 7, 21, 12, 1, tzinfo=timezone.utc),
        )
        self.assertTrue(result.created)
        body = json.loads(created_transport.calls[0]["body"].decode("utf-8"))
        self.assertEqual(body["p_actor_role"], "curador")

        missing = self.store(
            QueueTransport(
                [response(400, {"code": "P0002", "message": "item not found"})]
            )
        )
        with self.assertRaises(NotFoundError):
            missing.record_feedback(
                workspace_id="workspace-1",
                request_id="request-1",
                track_id="missing",
                action="ignore",
                event_id="event-2",
                target_playlist_id=None,
                actor_id="user-1",
                actor_role="curador",
                max_actor_events_per_hour=200,
                occurred_at=datetime.now(timezone.utc),
            )

        limited = self.store(
            QueueTransport(
                [response(400, {"code": "P0001", "message": "rate limit exceeded"})]
            )
        )
        with self.assertRaisesRegex(DomainError, "rate limit"):
            limited.record_feedback(
                workspace_id="workspace-1",
                request_id="request-1",
                track_id="track-1",
                action="save",
                event_id="event-3",
                target_playlist_id=None,
                actor_id="user-1",
                actor_role="curador",
                max_actor_events_per_hour=200,
                occurred_at=datetime.now(timezone.utc),
            )

    def test_training_rows_use_stable_keyset_pagination(self) -> None:
        newest = datetime(2026, 7, 21, 12, 0, tzinfo=timezone.utc)

        def training_row(index):
            created_at = newest - timedelta(seconds=index)
            return {
                "event_id": "event-%03d" % index,
                "request_id": "request-%03d" % index,
                "track_id": "track-%03d" % index,
                "action": "save" if index % 2 == 0 else "ignore",
                "target_playlist_id": None,
                "occurred_at": created_at.isoformat(),
                "server_created_at": created_at.isoformat(),
                "impression_playlist_id": "playlist-1",
                "features_json": {"bias": 1.0},
                "base_score": 50.0,
                "propensity": 1.0,
            }

        first_page = [training_row(index) for index in range(50)]
        second_page = [training_row(50)]
        transport = QueueTransport(
            [response(200, first_page), response(200, second_page)]
        )
        store = self.store(transport, page_size=50)
        rows = store.feedback_rows("workspace-1", limit=51)

        self.assertEqual(len(rows), 51)
        self.assertEqual(rows[0]["event_id"], "event-050")
        self.assertEqual(rows[-1]["event_id"], "event-000")
        self.assertIsInstance(rows[0]["features_json"], str)
        second_payload = json.loads(transport.calls[1]["body"].decode("utf-8"))
        self.assertEqual(second_payload["p_before_event_id"], "event-049")
        self.assertEqual(
            second_payload["p_before_created_at"],
            first_page[-1]["server_created_at"],
        )

    def test_model_and_maintenance_write_contracts(self) -> None:
        def start_response(call):
            body = json.loads(call["body"].decode("utf-8"))
            return response(200, [{"run_id": body["p_run_id"]}])

        maintenance = {
            "run_id": "run-1",
            "workspace_id": "workspace-1",
            "trigger_name": "api",
            "status": "completed",
            "started_at": "2026-07-21T12:00:00Z",
            "finished_at": "2026-07-21T12:01:00Z",
            "examples_count": 20,
            "candidate_version": "logistic-v1",
            "promoted": True,
            "guardrails_json": {"auc_floor": True},
            "metrics_json": {"auc": 0.7},
            "error_message": None,
        }
        transport = QueueTransport(
            [
                response(201),
                response(204),
                response(200, [model_row(status="rejected")]),
                start_response,
                response(200, [maintenance]),
                response(200, [maintenance]),
            ]
        )
        store = self.store(transport)
        store.register_candidate(
            workspace_id="workspace-1",
            version="logistic-v1",
            artifact_json='{"weights":{"bias":0.1}}',
            metrics={"auc": 0.7},
            training_start=None,
            training_end=None,
        )
        store.promote_model("workspace-1", "logistic-v1")
        store.reject_model("workspace-1", "logistic-v1")
        run_id = store.start_maintenance("workspace-1", "api")
        finished = store.finish_maintenance(
            run_id,
            status="completed",
            examples_count=20,
            candidate_version="logistic-v1",
            promoted=True,
            guardrails={"auc_floor": True},
            metrics={"auc": 0.7},
        )
        fetched = store.get_maintenance_run(run_id)

        self.assertTrue(finished["promoted"])
        self.assertEqual(finished["guardrails"], {"auc_floor": True})
        self.assertEqual(fetched["metrics"], {"auc": 0.7})
        self.assertIn("/rpc/playlist_ai_promote_model", transport.calls[1]["url"])
        self.assertIn("status=eq.candidate", transport.calls[2]["url"])

    def test_health_degrades_without_raising_or_exposing_credentials(self) -> None:
        transport = QueueTransport(
            [response(503, {"code": "down", "message": "unavailable"})]
        )
        store = self.store(transport, max_attempts=1)
        health = store.health()
        self.assertFalse(health["ok"])
        self.assertEqual(health["backend"], "supabase_data_api")

    def test_health_requires_the_exact_deployed_schema_contract(self) -> None:
        healthy_transport = QueueTransport([response(200, 1), response(200, [])])
        health = self.store(healthy_transport).health()
        self.assertTrue(health["ok"])
        self.assertIn(
            "/rest/v1/rpc/playlist_ai_agent_schema_version",
            healthy_transport.calls[0]["url"],
        )

        mismatched = self.store(QueueTransport([response(200, 2)]))
        self.assertFalse(mismatched.health()["ok"])


class DefaultStoreSelectionTests(unittest.TestCase):
    def test_local_defaults_to_sqlite(self) -> None:
        with patch.dict(
            os.environ,
            {"PLAYLISTS_AI_DB_PATH": ":memory:"},
            clear=True,
        ):
            store = build_default_store()
        self.assertIsInstance(store, SQLiteStore)
        store.close()

    def test_vercel_requires_complete_supabase_configuration(self) -> None:
        with patch.dict(os.environ, {"VERCEL": "1"}, clear=True):
            with self.assertRaises(SupabaseConfigurationError):
                build_default_store()
        with patch.dict(
            os.environ,
            {
                "VERCEL": "1",
                "PLAYLISTS_AI_STORE": "sqlite",
                "PLAYLISTS_AI_DB_PATH": ":memory:",
            },
            clear=True,
        ):
            with self.assertRaises(SupabaseConfigurationError):
                build_default_store()

    def test_explicit_supabase_selection_is_lazy_and_complete(self) -> None:
        with patch.dict(
            os.environ,
            {
                "PLAYLISTS_AI_STORE": "supabase",
                "NEXT_PUBLIC_SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "secret",
            },
            clear=True,
        ):
            store = build_default_store()
        self.assertIsInstance(store, SupabaseDataApiStore)

        with patch.dict(
            os.environ,
            {
                "PLAYLISTS_AI_STORE": "supabase",
                "NEXT_PUBLIC_SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_SECRET_KEY": "sb_secret_modern",
                "SUPABASE_SERVICE_ROLE_KEY": "legacy-fallback",
            },
            clear=True,
        ):
            modern_store = build_default_store()
        self.assertIsInstance(modern_store, SupabaseDataApiStore)
        self.assertEqual(modern_store._server_key, "sb_secret_modern")

        with patch.dict(
            os.environ,
            {
                "NEXT_PUBLIC_SUPABASE_URL": "https://project.supabase.co",
            },
            clear=True,
        ):
            with self.assertRaises(SupabaseConfigurationError):
                build_default_store()


if __name__ == "__main__":
    unittest.main()
