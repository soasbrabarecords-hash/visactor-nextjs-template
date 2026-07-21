"""Dependency-free domain contracts and validation helpers."""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


class DomainError(ValueError):
    """Raised when a request violates a domain invariant."""


class NotFoundError(DomainError):
    """Raised when a workspace-scoped entity cannot be found."""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_datetime(value: Any, *, field_name: str = "timestamp") -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str) and value.strip():
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise DomainError("%s must be an ISO-8601 timestamp" % field_name) from exc
    else:
        raise DomainError("%s is required" % field_name)

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def isoformat(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", " ", without_marks.lower()).strip()


def clamp(value: Any, minimum: float = 0.0, maximum: float = 100.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = (minimum + maximum) / 2.0
    if not math.isfinite(number):
        number = (minimum + maximum) / 2.0
    return min(maximum, max(minimum, number))


def clean_identifier(value: str, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise DomainError("%s is required" % field_name)
    if len(cleaned) > 200:
        raise DomainError("%s is too long" % field_name)
    return cleaned


def normalize_artists(value: Any) -> Tuple[str, ...]:
    if isinstance(value, str):
        raw = value.strip()
        # Preserve the original credit because commas can be part of a stage
        # name. Protect known comma-bearing aliases before splitting credits.
        protected = re.sub(
            r"\bryu,\s*the\s+runner\b",
            "Ryu The Runner",
            raw,
            flags=re.I,
        )
        parts = re.split(
            r",|&|\bfeat\.?\b|\bft\.?\b|\bpart\.?\b", protected, flags=re.I
        ) + [raw]
    elif isinstance(value, (list, tuple)):
        parts = [str(item) for item in value]
    else:
        parts = []
    artists = tuple(dict.fromkeys(part.strip() for part in parts if part and part.strip()))
    return artists or ("Artista nao informado",)


@dataclass(frozen=True)
class Candidate:
    track_id: str
    name: str
    artists: Tuple[str, ...]
    genre: str = "desconhecido"
    market: str = "BR"
    opportunity: float = 50.0
    fit: float = 50.0
    heat: float = 50.0
    momentum: float = 50.0
    freshness: float = 50.0
    stability: float = 50.0
    saturation: float = 50.0
    crossover: float = 0.0
    current_position: Optional[int] = None
    movement_7d: Optional[float] = None
    observed_days_30: int = 0
    is_new_entry: bool = False
    extra: Dict[str, Any] = field(default_factory=dict, compare=False)

    @classmethod
    def build(
        cls,
        *,
        track_id: str,
        name: str,
        artists: Any,
        genre: Optional[str] = None,
        market: Optional[str] = None,
        opportunity: Any = 50.0,
        fit: Any = 50.0,
        heat: Any = 50.0,
        momentum: Any = 50.0,
        freshness: Any = 50.0,
        stability: Any = 50.0,
        saturation: Any = 50.0,
        crossover: Any = 0.0,
        current_position: Optional[int] = None,
        movement_7d: Optional[float] = None,
        observed_days_30: Any = 0,
        is_new_entry: Any = False,
        extra: Optional[Dict[str, Any]] = None,
    ) -> "Candidate":
        position = None
        if current_position is not None:
            try:
                parsed_position = int(current_position)
                position = parsed_position if parsed_position > 0 else None
            except (TypeError, ValueError):
                position = None
        movement = None
        if movement_7d is not None:
            try:
                parsed_movement = float(movement_7d)
                movement = parsed_movement if math.isfinite(parsed_movement) else None
            except (TypeError, ValueError):
                movement = None
        try:
            observed = max(0, min(30, int(observed_days_30)))
        except (TypeError, ValueError):
            observed = 0

        return cls(
            track_id=clean_identifier(track_id, "track_id"),
            name=clean_identifier(name, "name"),
            artists=normalize_artists(artists),
            genre=(genre or "desconhecido").strip().lower(),
            market=(market or "BR").strip().upper(),
            opportunity=clamp(opportunity),
            fit=clamp(fit),
            heat=clamp(heat),
            momentum=clamp(momentum),
            freshness=clamp(freshness),
            stability=clamp(stability),
            saturation=clamp(saturation),
            crossover=clamp(crossover),
            current_position=position,
            movement_7d=movement,
            observed_days_30=observed,
            is_new_entry=bool(is_new_entry),
            extra=dict(extra or {}),
        )

    @property
    def primary_artist(self) -> str:
        raw = self.artists[0]
        if re.search(r",\s*the\s+runner\b", raw, flags=re.I):
            return normalize_text(raw)
        return normalize_text(raw.split(",", 1)[0])

    def snapshot(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "name": self.name,
            "artists": list(self.artists),
            "genre": self.genre,
            "market": self.market,
            "opportunity": self.opportunity,
            "fit": self.fit,
            "heat": self.heat,
            "momentum": self.momentum,
            "freshness": self.freshness,
            "stability": self.stability,
            "saturation": self.saturation,
            "crossover": self.crossover,
            "current_position": self.current_position,
            "movement_7d": self.movement_7d,
            "observed_days_30": self.observed_days_30,
            "is_new_entry": self.is_new_entry,
            "extra": self.extra,
        }


@dataclass(frozen=True)
class RankRequest:
    workspace_id: str
    playlist_id: str
    playlist_name: str
    genre: str
    market: str
    as_of: datetime
    limit: int
    candidates: Tuple[Candidate, ...]

    @classmethod
    def build(
        cls,
        *,
        workspace_id: str,
        playlist_id: str,
        playlist_name: str,
        genre: Optional[str],
        market: Optional[str],
        as_of: Any,
        limit: Any,
        candidates: Sequence[Candidate],
    ) -> "RankRequest":
        try:
            parsed_limit = int(limit)
        except (TypeError, ValueError) as exc:
            raise DomainError("limit must be an integer") from exc
        if parsed_limit < 1 or parsed_limit > 100:
            raise DomainError("limit must be between 1 and 100")
        if not candidates:
            raise DomainError("at least one candidate is required")
        if len(candidates) > 1000:
            raise DomainError("at most 1000 candidates are allowed")

        return cls(
            workspace_id=clean_identifier(workspace_id, "workspace_id"),
            playlist_id=clean_identifier(playlist_id, "playlist_id"),
            playlist_name=clean_identifier(playlist_name, "playlist_name"),
            genre=(genre or "desconhecido").strip().lower(),
            market=(market or "BR").strip().upper(),
            as_of=parse_datetime(as_of, field_name="as_of"),
            limit=parsed_limit,
            candidates=tuple(candidates),
        )


@dataclass(frozen=True)
class RankedItem:
    track_id: str
    rank: int
    score: float
    base_score: float
    learned_score: Optional[float]
    reason_codes: Tuple[str, ...]
    propensity: float
    features: Dict[str, float] = field(repr=False, compare=False)
    candidate_snapshot: Dict[str, Any] = field(repr=False, compare=False)

    def response(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "rank": self.rank,
            "score": round(clamp(self.score), 4),
            "base_score": round(clamp(self.base_score), 4),
            "learned_score": (
                round(clamp(self.learned_score), 4)
                if self.learned_score is not None
                else None
            ),
            "reason_codes": list(self.reason_codes),
            "propensity": round(min(1.0, max(0.0, self.propensity)), 6),
        }


@dataclass(frozen=True)
class RankResult:
    request_id: str
    model_version: str
    personalized: bool
    cold_start: bool
    items: Tuple[RankedItem, ...]

    def response(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "model_version": self.model_version,
            "personalized": self.personalized,
            "cold_start": self.cold_start,
            "items": [item.response() for item in self.items],
        }
