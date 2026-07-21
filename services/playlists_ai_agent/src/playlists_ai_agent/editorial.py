"""Tolerant loader for optional, time-scoped editorial knowledge."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple

from .domain import Candidate, DomainError, normalize_text, parse_datetime


RAP_TRAP_GENRES = {"rap", "trap"}


def _first_text(value: Mapping[str, Any], keys: Sequence[str]) -> Optional[str]:
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return None


def _artist_aliases(value: str) -> Set[str]:
    aliases = {normalize_text(value)}
    for separator in (" / ", " e ", " & "):
        if separator in value:
            aliases.update(normalize_text(part) for part in value.split(separator))
    return {alias for alias in aliases if alias}


def _iter_records(value: Any) -> Iterable[Any]:
    if isinstance(value, list):
        for item in value:
            yield item
    elif isinstance(value, dict):
        for nested in value.values():
            if isinstance(nested, (list, dict)):
                yield from _iter_records(nested)


def _collect_names(value: Any) -> Set[str]:
    names: Set[str] = set()
    for item in _iter_records(value):
        if isinstance(item, str):
            names.update(_artist_aliases(item))
        elif isinstance(item, dict):
            name = _first_text(
                item,
                ("artist", "artist_name", "name", "nome", "duo", "group"),
            )
            if name:
                names.update(_artist_aliases(name))
    return names


@dataclass(frozen=True)
class EditorialPrior:
    bonus: float
    reason_codes: Tuple[str, ...]


@dataclass(frozen=True)
class EditorialKnowledge:
    known_at: Optional[datetime]
    checksum: str
    ranked_artists: Dict[str, int]
    legacy_artists: Set[str]
    contemporary_artists: Set[str]
    future_bets: Set[str]
    known_tracks: Set[str]

    @classmethod
    def empty(cls) -> "EditorialKnowledge":
        return cls(None, "none", {}, set(), set(), set(), set())

    @classmethod
    def load(cls, path: Optional[str]) -> "EditorialKnowledge":
        if not path:
            return cls.empty()
        source = Path(path)
        if not source.exists():
            return cls.empty()
        try:
            raw = source.read_bytes()
            payload = json.loads(raw.decode("utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            return cls.empty()
        if not isinstance(payload, dict):
            return cls.empty()

        metadata = payload.get("metadata")
        known_at = None
        if isinstance(metadata, dict):
            raw_known_at = metadata.get("known_at")
            if raw_known_at:
                try:
                    known_at = parse_datetime(raw_known_at, field_name="metadata.known_at")
                except DomainError:
                    known_at = None

        ranked_artists: Dict[str, int] = {}
        for index, item in enumerate(_iter_records(payload.get("top_40")), start=1):
            if not isinstance(item, dict):
                continue
            artist = _first_text(item, ("artist", "artist_name", "name", "nome"))
            if not artist:
                continue
            try:
                rank = int(item.get("rank", item.get("position", index)))
            except (TypeError, ValueError):
                rank = index
            for alias in _artist_aliases(artist):
                ranked_artists[alias] = min(rank, ranked_artists.get(alias, rank))
            raw_aliases = item.get("aliases")
            if isinstance(raw_aliases, list):
                for raw_alias in raw_aliases:
                    if isinstance(raw_alias, str):
                        for alias in _artist_aliases(raw_alias):
                            ranked_artists[alias] = min(
                                rank, ranked_artists.get(alias, rank)
                            )

        known_tracks: Set[str] = set()
        for item in _iter_records(payload.get("tracks")):
            if not isinstance(item, dict):
                continue
            title = _first_text(item, ("track", "track_name", "title", "name", "musica"))
            artist = _first_text(item, ("artist", "artist_name", "artista"))
            raw_artists = item.get("artists")
            artists: List[str] = []
            if artist:
                artists.append(artist)
            if isinstance(raw_artists, str):
                artists.append(raw_artists)
            elif isinstance(raw_artists, list):
                artists.extend(
                    raw_artist for raw_artist in raw_artists if isinstance(raw_artist, str)
                )
            if title and artists:
                for alias in {
                    alias
                    for artist_name in artists
                    for alias in _artist_aliases(artist_name)
                }:
                    known_tracks.add("%s::%s" % (normalize_text(title), alias))

        return cls(
            known_at=known_at,
            checksum=hashlib.sha256(raw).hexdigest()[:12],
            ranked_artists=ranked_artists,
            legacy_artists=_collect_names(payload.get("legacy_artists")),
            contemporary_artists=_collect_names(payload.get("contemporary_artists")),
            future_bets=_collect_names(payload.get("future_bets")),
            known_tracks=known_tracks,
        )

    def prior_for(
        self, candidate: Candidate, playlist_genre: str, as_of: datetime
    ) -> EditorialPrior:
        if (
            self.known_at is None
            or as_of < self.known_at
            or normalize_text(playlist_genre) not in RAP_TRAP_GENRES
            or normalize_text(candidate.genre) not in RAP_TRAP_GENRES
        ):
            return EditorialPrior(0.0, tuple())

        aliases = {normalize_text(artist) for artist in candidate.artists}
        reasons: List[str] = []
        bonus = 0.0

        ranks = [self.ranked_artists[alias] for alias in aliases if alias in self.ranked_artists]
        if ranks:
            best_rank = min(ranks)
            bonus += max(0.5, 5.0 * (41.0 - min(40, best_rank)) / 40.0)
            reasons.append("editorial_top_40")
            if best_rank <= 10:
                reasons.append("editorial_top_10")
        if aliases & self.legacy_artists:
            bonus += 1.25
            reasons.append("editorial_legacy")
        if aliases & self.contemporary_artists:
            bonus += 0.75
            reasons.append("editorial_contemporary")
        if aliases & self.future_bets:
            bonus += 1.5
            reasons.append("editorial_future_bet")

        track_key_matches = {
            "%s::%s" % (normalize_text(candidate.name), alias) for alias in aliases
        }
        if track_key_matches & self.known_tracks:
            bonus += 2.0
            reasons.append("editorial_known_track")

        return EditorialPrior(min(7.0, bonus), tuple(dict.fromkeys(reasons)))
