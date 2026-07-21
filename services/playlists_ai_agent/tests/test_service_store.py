from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

from playlists_ai_agent.domain import (
    Candidate,
    DomainError,
    NotFoundError,
    RankRequest,
    isoformat,
    utc_now,
)
from playlists_ai_agent.editorial import EditorialKnowledge
from playlists_ai_agent.service import AgentConfig, PlaylistsAiService
from playlists_ai_agent.store import SQLiteStore


def candidate(
    track_id: str,
    *,
    artist: str,
    genre: str = "trap",
    baseline: float = 50.0,
    opportunity: float = 50.0,
    fit: float = 50.0,
) -> Candidate:
    return Candidate.build(
        track_id=track_id,
        name="Faixa %s" % track_id,
        artists=artist,
        genre=genre,
        market="BR",
        opportunity=opportunity,
        fit=fit,
        extra={"baseline_score": baseline},
    )


class ServiceStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.store = SQLiteStore(str(Path(self.temp.name) / "agent.db"))
        self.config = AgentConfig(
            learned_weight=0.65,
            exploration_epsilon=0.0,
            exploration_pool_size=3,
            artist_repeat_penalty=9.0,
            min_training_examples=12,
            min_examples_per_class=4,
            validation_fraction=0.25,
            max_propensity_weight=5.0,
            max_training_events=1000,
            max_workspaces_per_run=10,
            max_actor_events_per_hour=200,
        )
        self.service = PlaylistsAiService(
            self.store,
            config=self.config,
            editorial=EditorialKnowledge.empty(),
        )

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def request(self, candidates, *, workspace="workspace-1", playlist="playlist-1"):
        return RankRequest.build(
            workspace_id=workspace,
            playlist_id=playlist,
            playlist_name="Playlist",
            genre="trap",
            market="BR",
            as_of=isoformat(utc_now()),
            limit=len(candidates),
            candidates=candidates,
        )

    def test_cold_start_ranks_and_freezes_impression(self) -> None:
        result = self.service.rank(
            self.request(
                [
                    candidate("low", artist="B", baseline=20),
                    candidate("high", artist="A", baseline=90),
                ]
            )
        )
        self.assertTrue(result.cold_start)
        self.assertFalse(result.personalized)
        self.assertEqual(result.model_version, "baseline-v1")
        self.assertEqual([item.track_id for item in result.items], ["high", "low"])
        row = self.store.get_item("workspace-1", result.request_id, "high")
        self.assertEqual(row["base_score"], 90)
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store._connection:
                self.store._connection.execute(
                    "UPDATE recommendation_items SET score = 0 WHERE request_id = ?",
                    (result.request_id,),
                )

    def test_duplicate_tracks_are_only_impressed_once(self) -> None:
        result = self.service.rank(
            self.request(
                [
                    candidate("same", artist="A", baseline=20),
                    candidate("same", artist="A", baseline=80),
                ]
            )
        )
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.items[0].base_score, 80)

    def test_diversity_penalizes_repeated_primary_artist_in_collabs(self) -> None:
        result = self.service.rank(
            self.request(
                [
                    candidate("matue-1", artist="Matuê, Teto", baseline=90),
                    candidate("matue-2", artist="Matuê feat. WIU", baseline=88),
                    candidate("veigh", artist="Veigh", baseline=84),
                ]
            )
        )
        self.assertEqual(
            [item.track_id for item in result.items],
            ["matue-1", "veigh", "matue-2"],
        )
        self.assertIn("diversity_artist_repeat", result.items[2].reason_codes)

    def test_feedback_is_idempotent_and_collision_is_rejected(self) -> None:
        result = self.service.rank(
            self.request(
                [
                    candidate("a", artist="A"),
                    candidate("b", artist="B"),
                ]
            )
        )
        first = self.service.feedback(
            workspace_id="workspace-1",
            request_id=result.request_id,
            track_id="a",
            action="save",
            event_id="event-1",
            actor_id="user-1",
            actor_role="curator",
        )
        retry = self.service.feedback(
            workspace_id="workspace-1",
            request_id=result.request_id,
            track_id="a",
            action="save",
            event_id="event-1",
            actor_id="user-1",
            actor_role="curator",
        )
        self.assertTrue(first.created)
        self.assertFalse(retry.created)
        with self.assertRaises(DomainError):
            self.service.feedback(
                workspace_id="workspace-1",
                request_id=result.request_id,
                track_id="b",
                action="save",
                event_id="event-1",
                actor_id="user-1",
                actor_role="curator",
            )

    def test_actor_rate_limit_does_not_break_idempotent_retries(self) -> None:
        limited = PlaylistsAiService(
            self.store,
            config=replace(self.config, max_actor_events_per_hour=2),
        )
        results = [
            limited.rank(self.request([candidate("rate-%d" % index, artist="A")]))
            for index in range(3)
        ]
        for index in range(2):
            limited.feedback(
                workspace_id="workspace-1",
                request_id=results[index].request_id,
                track_id="rate-%d" % index,
                action="save",
                event_id="rate-event-%d" % index,
                actor_id="rate-user",
                actor_role="curador",
            )
        retry = limited.feedback(
            workspace_id="workspace-1",
            request_id=results[0].request_id,
            track_id="rate-0",
            action="save",
            event_id="rate-event-0",
            actor_id="rate-user",
            actor_role="curador",
        )
        self.assertFalse(retry.created)
        with self.assertRaises(DomainError):
            limited.feedback(
                workspace_id="workspace-1",
                request_id=results[2].request_id,
                track_id="rate-2",
                action="save",
                event_id="rate-event-2",
                actor_id="rate-user",
                actor_role="curador",
            )

    def test_feedback_cannot_cross_workspace_or_use_invalid_time(self) -> None:
        result = self.service.rank(
            self.request([candidate("a", artist="A")])
        )
        with self.assertRaises(NotFoundError):
            self.service.feedback(
                workspace_id="other",
                request_id=result.request_id,
                track_id="a",
                action="ignore",
                actor_id="user-1",
                actor_role="curador",
            )
        with self.assertRaises(DomainError):
            self.service.feedback(
                workspace_id="workspace-1",
                request_id=result.request_id,
                track_id="a",
                action="ignore",
                actor_id="user-1",
                actor_role="curador",
                occurred_at=isoformat(utc_now() + timedelta(minutes=10)),
            )
        with self.assertRaises(DomainError):
            self.service.feedback(
                workspace_id="workspace-1",
                request_id=result.request_id,
                track_id="a",
                action="ignore",
                actor_id="user-1",
                actor_role="curador",
                occurred_at=isoformat(utc_now() - timedelta(hours=1)),
            )

    def test_add_to_other_playlist_is_audited_but_not_trained(self) -> None:
        result = self.service.rank(
            self.request([candidate("a", artist="A")])
        )
        self.service.feedback(
            workspace_id="workspace-1",
            request_id=result.request_id,
            track_id="a",
            action="add",
            event_id="different-target",
            target_playlist_id="playlist-2",
            actor_id="user-1",
            actor_role="curador",
        )
        self.assertEqual(self.service._training_examples("workspace-1"), [])
        rows = self.store.feedback_rows("workspace-1")
        self.assertEqual(rows[0]["target_playlist_id"], "playlist-2")

    def test_add_requires_the_actual_target_playlist(self) -> None:
        result = self.service.rank(self.request([candidate("a", artist="A")]))
        with self.assertRaises(DomainError):
            self.service.feedback(
                workspace_id="workspace-1",
                request_id=result.request_id,
                track_id="a",
                action="add",
                actor_id="user-1",
                actor_role="curador",
            )

    def test_training_order_uses_server_time_not_client_timestamp(self) -> None:
        result = self.service.rank(
            self.request([candidate("a", artist="A")])
        )
        supplied = utc_now() - timedelta(minutes=1)
        self.service.feedback(
            workspace_id="workspace-1",
            request_id=result.request_id,
            track_id="a",
            action="save",
            event_id="skewed-client-clock",
            actor_id="user-1",
            actor_role="curador",
            occurred_at=isoformat(supplied),
        )
        example = self.service._training_examples("workspace-1")[0]
        self.assertGreater(example.occurred_at, supplied + timedelta(seconds=30))

    def _seed_training_feedback(self) -> None:
        base_time = utc_now()
        for index in range(12):
            positive_id = "positive-%02d" % index
            negative_id = "negative-%02d" % index
            result = self.service.rank(
                self.request(
                    [
                        candidate(
                            positive_id,
                            artist="Trap Artist %d" % index,
                            genre="trap",
                            baseline=50,
                        ),
                        candidate(
                            negative_id,
                            artist="Pop Artist %d" % index,
                            genre="pop",
                            baseline=50,
                        ),
                    ]
                )
            )
            self.service.feedback(
                workspace_id="workspace-1",
                request_id=result.request_id,
                track_id=positive_id,
                action="add",
                event_id="positive-event-%02d" % index,
                target_playlist_id="playlist-1",
                actor_id="user-1",
                actor_role="curador",
                occurred_at=isoformat(base_time + timedelta(seconds=index * 2)),
            )
            self.service.feedback(
                workspace_id="workspace-1",
                request_id=result.request_id,
                track_id=negative_id,
                action="ignore",
                event_id="negative-event-%02d" % index,
                actor_id="user-1",
                actor_role="curador",
                occurred_at=isoformat(base_time + timedelta(seconds=index * 2 + 1)),
            )

    def test_maintenance_promotes_temporally_valid_model_and_is_auditable(self) -> None:
        self._seed_training_feedback()
        maintenance = self.service.run_maintenance("workspace-1")
        run = maintenance["runs"][0]
        self.assertEqual(run["status"], "completed")
        self.assertTrue(run["promoted"], run)
        self.assertTrue(all(run["guardrails"].values()), run["guardrails"])

        ranked = self.service.rank(
            self.request(
                [
                    candidate("new-trap", artist="A", genre="trap", baseline=50),
                    candidate("new-pop", artist="B", genre="pop", baseline=50),
                ]
            )
        )
        self.assertTrue(ranked.personalized)
        self.assertFalse(ranked.cold_start)
        self.assertTrue(ranked.model_version.startswith("logistic-v1-"))
        self.assertIsNotNone(ranked.items[0].learned_score)

        repeated = self.service.run_maintenance("workspace-1")
        self.assertEqual(repeated["runs"][0]["status"], "skipped")
        self.assertFalse(repeated["runs"][0]["promoted"])

    def test_maintenance_recovers_from_invalid_active_artifact(self) -> None:
        self._seed_training_feedback()
        self.store.ensure_baseline("workspace-1")
        self.store.register_candidate(
            workspace_id="workspace-1",
            version="broken-logistic",
            artifact_json='{"weights":{"bias":NaN}}',
            metrics={},
            training_start=None,
            training_end=None,
        )
        self.store.promote_model("workspace-1", "broken-logistic")

        result = self.service.run_maintenance("workspace-1")
        run = result["runs"][0]
        self.assertTrue(run["promoted"], run)
        self.assertFalse(run["metrics"]["champion_artifact_valid"])
        active = self.store.get_active_model("workspace-1")
        self.assertIsNotNone(active)
        self.assertNotEqual(active.version, "broken-logistic")

    def test_insufficient_maintenance_and_global_empty_run_are_audited(self) -> None:
        empty_store = SQLiteStore(str(Path(self.temp.name) / "empty.db"))
        try:
            empty_service = PlaylistsAiService(empty_store, config=self.config)
            global_result = empty_service.run_maintenance()
            self.assertEqual(global_result["runs"][0]["workspace_id"], "__all__")
            self.assertEqual(global_result["runs"][0]["status"], "skipped")
        finally:
            empty_store.close()


if __name__ == "__main__":
    unittest.main()
