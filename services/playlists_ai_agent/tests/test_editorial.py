from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from playlists_ai_agent.domain import Candidate, parse_datetime
from playlists_ai_agent.editorial import EditorialKnowledge
from playlists_ai_agent.service import default_editorial_path


class EditorialKnowledgeTests(unittest.TestCase):
    def test_actual_seed_is_discoverable_and_tracks_are_loaded(self) -> None:
        knowledge = EditorialKnowledge.load(default_editorial_path())
        self.assertIsNotNone(knowledge.known_at)

        matue = Candidate.build(
            track_id="kenny", name="Kenny G", artists="Matuê", genre="trap"
        )
        prior = knowledge.prior_for(
            matue, "trap", parse_datetime("2026-07-22T00:00:00Z")
        )
        self.assertGreater(prior.bonus, 0)
        self.assertIn("editorial_top_10", prior.reason_codes)
        self.assertIn("editorial_known_track", prior.reason_codes)

        ryu = Candidate.build(
            track_id="ryu",
            name="Lido com Crises",
            artists="Ryu, The Runner",
            genre="trap",
        )
        ryu_prior = knowledge.prior_for(
            ryu, "trap", parse_datetime("2026-07-22T00:00:00Z")
        )
        self.assertIn("editorial_top_40", ryu_prior.reason_codes)
        self.assertIn("editorial_future_bet", ryu_prior.reason_codes)

    def test_prior_is_time_and_genre_gated(self) -> None:
        knowledge = EditorialKnowledge.load(default_editorial_path())
        candidate = Candidate.build(
            track_id="1", name="Kenny G", artists="Matuê", genre="trap"
        )
        before = knowledge.prior_for(
            candidate, "trap", parse_datetime("2026-07-20T00:00:00Z")
        )
        wrong_genre = knowledge.prior_for(
            candidate, "pop", parse_datetime("2026-07-22T00:00:00Z")
        )
        self.assertEqual(before.bonus, 0)
        self.assertEqual(wrong_genre.bonus, 0)

    def test_loader_ignores_extra_fields_and_invalid_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "seed.json"
            path.write_text(
                json.dumps(
                    {
                        "metadata": {"known_at": "2026-01-01", "extra": True},
                        "top_40": [{"rank": 1, "name": "Artista", "unknown": 1}],
                        "tracks": {"era": {"items": []}},
                        "new_future_section": {"anything": [1, 2, 3]},
                    }
                ),
                encoding="utf-8",
            )
            knowledge = EditorialKnowledge.load(str(path))
            self.assertEqual(knowledge.ranked_artists["artista"], 1)
            self.assertEqual(EditorialKnowledge.load(str(path) + ".missing").checksum, "none")


if __name__ == "__main__":
    unittest.main()

