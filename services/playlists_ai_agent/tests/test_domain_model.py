from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone

from playlists_ai_agent.domain import Candidate, DomainError, RankRequest
from playlists_ai_agent.model import (
    LogisticModel,
    TrainingExample,
    baseline_score,
    binary_auc,
    build_features,
    score_to_probability,
    train_with_temporal_holdout,
)


class DomainAndModelTests(unittest.TestCase):
    def test_candidate_is_robust_to_missing_and_invalid_scores(self) -> None:
        candidate = Candidate.build(
            track_id="track-1",
            name="Faixa",
            artists="Artista",
            opportunity=None,
            fit=float("nan"),
            saturation=500,
        )
        self.assertEqual(candidate.opportunity, 50.0)
        self.assertEqual(candidate.fit, 50.0)
        self.assertEqual(candidate.saturation, 100.0)

    def test_artist_parser_preserves_ryu_and_prioritizes_collab_members(self) -> None:
        ryu = Candidate.build(
            track_id="ryu", name="Faixa", artists="Ryu, The Runner"
        )
        collab = Candidate.build(
            track_id="collab", name="Faixa", artists="Matuê, Teto"
        )
        self.assertEqual(ryu.primary_artist, "ryu the runner")
        self.assertEqual(collab.primary_artist, "matue")
        self.assertIn("Matuê, Teto", collab.artists)

        ryu_collab = Candidate.build(
            track_id="ryu-collab",
            name="Faixa",
            artists="Ryu, The Runner, Vulgo FK",
        )
        self.assertEqual(ryu_collab.primary_artist, "ryu the runner")
        self.assertIn("Vulgo FK", ryu_collab.artists)

    def test_rank_request_validates_limits(self) -> None:
        candidate = Candidate.build(track_id="1", name="A", artists="B")
        with self.assertRaises(DomainError):
            RankRequest.build(
                workspace_id="w",
                playlist_id="p",
                playlist_name="P",
                genre="trap",
                market="BR",
                as_of="2026-07-21T00:00:00Z",
                limit=0,
                candidates=[candidate],
            )

    def test_baseline_prefers_supplied_score_then_uses_ts_parity(self) -> None:
        supplied = Candidate.build(
            track_id="1",
            name="A",
            artists="B",
            opportunity=10,
            fit=20,
            extra={"baseline_score": 81},
        )
        fallback = Candidate.build(
            track_id="2", name="A", artists="B", opportunity=80, fit=50
        )
        self.assertEqual(baseline_score(supplied), 81)
        self.assertAlmostEqual(baseline_score(fallback), 0.68 * 80 + 0.32 * 50)
        self.assertEqual(baseline_score(supplied, 30), 88)

    def test_score_is_calibrated_instead_of_divided_by_100(self) -> None:
        self.assertAlmostEqual(score_to_probability(50), 0.5)
        self.assertGreater(score_to_probability(80), 0.8)
        self.assertLess(score_to_probability(20), 0.2)

    def test_auc_uses_tie_aware_ranking(self) -> None:
        self.assertEqual(binary_auc([0, 1, 0, 1], [0.1, 0.9, 0.2, 0.8]), 1.0)
        self.assertEqual(binary_auc([0, 1], [0.5, 0.5]), 0.5)

    def test_logistic_artifact_rejects_non_finite_weights(self) -> None:
        with self.assertRaises(ValueError):
            LogisticModel.from_json(
                json.dumps({"weights": {"bias": float("nan")}})
            )
        with self.assertRaises(ValueError):
            LogisticModel.from_json(
                json.dumps({"weights": {"fit": float("inf")}})
            )

    def test_logistic_artifact_rejects_non_object_shapes(self) -> None:
        for artifact in ('[]', '"oops"', '{"weights": []}'):
            with self.subTest(artifact=artifact), self.assertRaises(ValueError):
                LogisticModel.from_json(artifact)

    def test_temporal_training_uses_latest_examples_as_holdout(self) -> None:
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        examples = []
        for index in range(20):
            positive = index % 2
            examples.append(
                TrainingExample(
                    features={"bias": 1.0, "genre_match": float(positive)},
                    label=positive,
                    weight=1.0,
                    occurred_at=start + timedelta(days=index),
                    base_probability=0.5,
                )
            )
        result = train_with_temporal_holdout(examples, validation_fraction=0.25)
        self.assertEqual(result.validation_examples, 5)
        self.assertEqual(result.validation[0].occurred_at, start + timedelta(days=15))
        self.assertGreaterEqual(result.metrics["candidate"]["auc"], 0.9)

    def test_temporal_groups_are_ordered_by_latest_event(self) -> None:
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        examples = [
            TrainingExample(
                {"bias": 1.0}, 1, 1.0, start, 0.5, group_id="request-a"
            ),
            TrainingExample(
                {"bias": 1.0},
                0,
                1.0,
                start + timedelta(days=50),
                0.5,
                group_id="request-b",
            ),
            TrainingExample(
                {"bias": 1.0},
                0,
                1.0,
                start + timedelta(days=100),
                0.5,
                group_id="request-a",
            ),
        ]
        result = train_with_temporal_holdout(examples, validation_count=1)
        self.assertEqual({item.group_id for item in result.validation}, {"request-a"})
        self.assertEqual(len(result.validation), 2)


if __name__ == "__main__":
    unittest.main()
