from __future__ import annotations

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("PLAYLISTS_AI_DB_PATH", ":memory:")

try:
    from fastapi.testclient import TestClient

    from playlists_ai_agent.api import create_app

    HTTP_TESTS_AVAILABLE = True
except (ImportError, RuntimeError):
    HTTP_TESTS_AVAILABLE = False

from playlists_ai_agent.service import PlaylistsAiService
from playlists_ai_agent.store import SQLiteStore


@unittest.skipUnless(
    HTTP_TESTS_AVAILABLE,
    "FastAPI/httpx are optional for the dependency-free core test run",
)
class FastApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = SQLiteStore(":memory:")
        self.service = PlaylistsAiService(self.store)
        self.client = TestClient(
            create_app(self.service, configured_token="test-service-token")
        )
        self.headers = {"X-Playlists-AI-Token": "test-service-token"}

    def tearDown(self) -> None:
        self.store.close()

    def test_auth_rank_feedback_and_maintenance_contract(self) -> None:
        self.assertEqual(self.client.get("/health").status_code, 401)
        self.assertEqual(
            self.client.get("/health", headers=self.headers).status_code,
            200,
        )

        rank = self.client.post(
            "/v1/rank",
            headers=self.headers,
            json={
                "workspace_id": "workspace-1",
                "playlist_id": "playlist-1",
                "playlist_name": "Trap Agora",
                "genre": "trap",
                "market": "BR",
                "as_of": "2026-07-21T12:00:00Z",
                "limit": 1,
                "candidates": [
                    {
                        "track_id": "track-1",
                        "name": "Faixa",
                        "artists": "Matuê",
                        "genre": "trap",
                        "market": "BR",
                        "opportunity_score": 82,
                        "playlist_fit": 91,
                        "baseline_score": 84.88,
                    }
                ],
            },
        )
        self.assertEqual(rank.status_code, 200, rank.text)
        result = rank.json()
        self.assertTrue(result["cold_start"])
        self.assertEqual(result["items"][0]["track_id"], "track-1")

        feedback = self.client.post(
            "/v1/feedback",
            headers=self.headers,
            json={
                "workspace_id": "workspace-1",
                "request_id": result["request_id"],
                "track_id": "track-1",
                "action": "save",
                "event_id": "feedback-1",
                "actor_id": "user-1",
                "actor_role": "curador",
            },
        )
        self.assertEqual(feedback.status_code, 200, feedback.text)
        self.assertTrue(feedback.json()["created"])

        maintenance = self.client.post(
            "/v1/maintenance/run",
            headers=self.headers,
            json={"workspace_id": "workspace-1", "dry_run": True},
        )
        self.assertEqual(maintenance.status_code, 200, maintenance.text)
        self.assertEqual(maintenance.json()["promoted"], 0)

    def test_missing_service_token_fails_closed(self) -> None:
        with patch.dict(
            os.environ,
            {"PLAYLISTS_AI_ALLOW_INSECURE_DEV": ""},
            clear=False,
        ):
            client = TestClient(create_app(self.service, configured_token=""))
        response = client.get("/health")
        self.assertEqual(response.status_code, 503)

    def test_openapi_is_disabled_in_production_and_available_in_dev(self) -> None:
        with patch.dict(
            os.environ,
            {
                "VERCEL_ENV": "production",
                "PLAYLISTS_AI_ENV": "",
                "PLAYLISTS_AI_ENABLE_DOCS": "true",
            },
            clear=False,
        ):
            production = TestClient(
                create_app(self.service, configured_token="test-service-token")
            )
        self.assertEqual(production.get("/docs").status_code, 404)
        self.assertEqual(production.get("/openapi.json").status_code, 404)

        with patch.dict(
            os.environ,
            {
                "VERCEL_ENV": "",
                "PLAYLISTS_AI_ENV": "",
                "PLAYLISTS_AI_ENABLE_DOCS": "",
            },
            clear=False,
        ):
            development = TestClient(
                create_app(self.service, configured_token="test-service-token")
            )
        self.assertEqual(development.get("/docs").status_code, 200)
        self.assertEqual(development.get("/openapi.json").status_code, 200)


if __name__ == "__main__":
    unittest.main()
