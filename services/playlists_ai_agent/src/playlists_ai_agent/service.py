"""Application service: ranking, frozen impressions, feedback, and maintenance."""

from __future__ import annotations

import hashlib
import json
import os
import random
import sys
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from .domain import (
    Candidate,
    DomainError,
    RankRequest,
    RankedItem,
    RankResult,
    clamp,
    isoformat,
    normalize_text,
    parse_datetime,
    utc_now,
)
from .editorial import EditorialKnowledge
from .model import (
    LogisticModel,
    TrainingExample,
    baseline_score,
    build_features,
    classification_metrics,
    score_to_probability,
    train_with_temporal_holdout,
)
from .store import AgentStore, FeedbackResult, SQLiteStore
from .supabase_store import (
    SupabaseConfigurationError,
    SupabaseDataApiStore,
)


POSITIVE_ACTIONS = {
    "save": 1.1,
    "pin": 1.3,
    "add": 1.5,
    "accepted": 1.2,
    "added": 1.5,
    "like": 1.0,
    "kept_7d": 1.7,
    "kept_30d": 2.0,
}
NEGATIVE_ACTIONS = {
    "ignore": 1.0,
    "rejected": 1.2,
    "dislike": 1.0,
    "removed": 1.4,
    "removed_early": 1.8,
    "unsave": 1.1,
    "unpin": 1.1,
}
INFORMATIONAL_ACTIONS = {"shown", "clicked", "watch"}
ALLOWED_ACTIONS = set(POSITIVE_ACTIONS) | set(NEGATIVE_ACTIONS) | INFORMATIONAL_ACTIONS


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class AgentConfig:
    learned_weight: float = 0.65
    exploration_epsilon: float = 0.05
    exploration_pool_size: int = 3
    artist_repeat_penalty: float = 9.0
    min_training_examples: int = 20
    min_examples_per_class: int = 5
    validation_fraction: float = 0.25
    max_propensity_weight: float = 5.0
    max_training_events: int = 50000
    max_workspaces_per_run: int = 100
    max_actor_events_per_hour: int = 200

    @classmethod
    def from_env(cls) -> "AgentConfig":
        return cls(
            learned_weight=max(0.0, min(1.0, _env_float("PLAYLISTS_AI_LEARNED_WEIGHT", 0.65))),
            exploration_epsilon=max(
                0.0, min(0.2, _env_float("PLAYLISTS_AI_EXPLORATION_EPSILON", 0.05))
            ),
            exploration_pool_size=max(
                1, min(10, _env_int("PLAYLISTS_AI_EXPLORATION_POOL_SIZE", 3))
            ),
            artist_repeat_penalty=max(
                0.0, _env_float("PLAYLISTS_AI_ARTIST_REPEAT_PENALTY", 9.0)
            ),
            min_training_examples=max(
                10, _env_int("PLAYLISTS_AI_MIN_TRAINING_EXAMPLES", 20)
            ),
            min_examples_per_class=max(
                2, _env_int("PLAYLISTS_AI_MIN_EXAMPLES_PER_CLASS", 5)
            ),
            validation_fraction=max(
                0.1, min(0.4, _env_float("PLAYLISTS_AI_VALIDATION_FRACTION", 0.25))
            ),
            max_propensity_weight=max(
                1.0, _env_float("PLAYLISTS_AI_MAX_PROPENSITY_WEIGHT", 5.0)
            ),
            max_training_events=max(
                100, _env_int("PLAYLISTS_AI_MAX_TRAINING_EVENTS", 50000)
            ),
            max_workspaces_per_run=max(
                1, _env_int("PLAYLISTS_AI_MAX_WORKSPACES_PER_RUN", 100)
            ),
            max_actor_events_per_hour=max(
                10, _env_int("PLAYLISTS_AI_MAX_ACTOR_EVENTS_PER_HOUR", 200)
            ),
        )


@dataclass
class _ScoredCandidate:
    candidate: Candidate
    base_score: float
    learned_score: Optional[float]
    raw_score: float
    reason_codes: List[str]
    features: Dict[str, float]


class PlaylistsAiService:
    def __init__(
        self,
        store: AgentStore,
        *,
        config: Optional[AgentConfig] = None,
        editorial: Optional[EditorialKnowledge] = None,
    ) -> None:
        self.store = store
        self.config = config or AgentConfig()
        self.editorial = editorial or EditorialKnowledge.empty()
        self._maintenance_lock = threading.Lock()

    def health(self) -> Dict[str, Any]:
        storage = self.store.health()
        return {
            "status": "ok" if storage["ok"] else "degraded",
            "service": "playlists-ai-agent",
            "version": "0.1.0",
            "time": isoformat(utc_now()),
            "storage": storage,
            "editorial": {
                "loaded": self.editorial.known_at is not None,
                "known_at": isoformat(self.editorial.known_at)
                if self.editorial.known_at
                else None,
                "checksum": self.editorial.checksum,
            },
        }

    def rank(self, request: RankRequest) -> RankResult:
        active = self.store.ensure_baseline(request.workspace_id)
        model: Optional[LogisticModel] = None
        model_version = active.version
        if active.kind == "logistic":
            try:
                model = LogisticModel.from_json(active.artifact_json)
            except (TypeError, ValueError, json.JSONDecodeError):
                model = None
                model_version = "baseline-fallback-v1"

        cold_start = model is None
        personalized = model is not None
        unique_candidates: Dict[str, Candidate] = {}
        for candidate in request.candidates:
            current = unique_candidates.get(candidate.track_id)
            if current is None or baseline_score(candidate) > baseline_score(current):
                unique_candidates[candidate.track_id] = candidate

        scored: List[_ScoredCandidate] = []
        for candidate in unique_candidates.values():
            editorial_prior = self.editorial.prior_for(
                candidate, request.genre, request.as_of
            )
            base = baseline_score(candidate, editorial_prior.bonus)
            features = build_features(
                candidate,
                playlist_genre=request.genre,
                playlist_market=request.market,
                editorial_bonus=editorial_prior.bonus,
            )
            learned = model.predict_probability(features) * 100.0 if model else None
            raw = (
                (1.0 - self.config.learned_weight) * base
                + self.config.learned_weight * float(learned)
                if learned is not None
                else base
            )
            reasons = self._reason_codes(
                candidate,
                request=request,
                base=base,
                learned=learned,
                editorial_reasons=editorial_prior.reason_codes,
            )
            scored.append(
                _ScoredCandidate(
                    candidate=candidate,
                    base_score=base,
                    learned_score=learned,
                    raw_score=clamp(raw),
                    reason_codes=reasons,
                    features=features,
                )
            )

        request_id = str(uuid.uuid4())
        ranked = self._diversified_rank(
            scored,
            limit=min(request.limit, len(scored)),
            request_id=request_id,
            exploration_enabled=personalized,
        )
        result = RankResult(
            request_id=request_id,
            model_version=model_version,
            personalized=personalized,
            cold_start=cold_start,
            items=tuple(ranked),
        )
        self.store.save_impression(
            request_id,
            request,
            ranked,
            model_version=model_version,
            personalized=personalized,
            cold_start=cold_start,
            context={
                "candidate_count": len(request.candidates),
                "unique_candidate_count": len(unique_candidates),
                "editorial_checksum": self.editorial.checksum,
                "editorial_known_at": isoformat(self.editorial.known_at)
                if self.editorial.known_at
                else None,
                "learned_weight": self.config.learned_weight,
                "exploration_epsilon": self.config.exploration_epsilon
                if personalized
                else 0.0,
            },
        )
        return result

    def _reason_codes(
        self,
        candidate: Candidate,
        *,
        request: RankRequest,
        base: float,
        learned: Optional[float],
        editorial_reasons: Sequence[str],
    ) -> List[str]:
        reasons: List[str] = []
        if candidate.fit >= 75:
            reasons.append("playlist_fit_high")
        if candidate.opportunity >= 70:
            reasons.append("opportunity_high")
        if candidate.heat >= 70:
            reasons.append("heat_high")
        if candidate.momentum >= 60:
            reasons.append("momentum_positive")
        if candidate.freshness >= 70 or candidate.is_new_entry:
            reasons.append("fresh_entry")
        if candidate.stability >= 65:
            reasons.append("stable_signal")
        if candidate.saturation <= 40:
            reasons.append("saturation_low")
        if candidate.current_position is not None and candidate.current_position <= 50:
            reasons.append("chart_top_50")
        if normalize_text(candidate.genre) == normalize_text(request.genre):
            reasons.append("genre_match")
        if request.market == "BOTH" or candidate.market.upper() == request.market:
            reasons.append("market_match")
        reasons.extend(editorial_reasons)
        if learned is not None:
            if learned >= base + 5:
                reasons.append("learned_preference_boost")
            elif learned <= base - 5:
                reasons.append("learned_preference_caution")
        if not reasons:
            reasons.append("baseline_balanced")
        return list(dict.fromkeys(reasons))[:12]

    def _diversified_rank(
        self,
        candidates: Sequence[_ScoredCandidate],
        *,
        limit: int,
        request_id: str,
        exploration_enabled: bool,
    ) -> List[RankedItem]:
        remaining = list(candidates)
        selected: List[RankedItem] = []
        artist_counts: Dict[str, int] = {}
        seed = int(hashlib.sha256(request_id.encode("utf-8")).hexdigest()[:16], 16)
        randomizer = random.Random(seed)
        epsilon = self.config.exploration_epsilon if exploration_enabled else 0.0

        while remaining and len(selected) < limit:
            adjusted: List[Tuple[float, float, _ScoredCandidate]] = []
            for item in remaining:
                repeat_count = artist_counts.get(item.candidate.primary_artist, 0)
                penalty = repeat_count * self.config.artist_repeat_penalty
                adjusted.append((item.raw_score - penalty, penalty, item))
            adjusted.sort(key=lambda entry: (-entry[0], entry[2].candidate.track_id))
            pool_size = min(self.config.exploration_pool_size, len(adjusted))
            explored = epsilon > 0.0 and pool_size > 1 and randomizer.random() < epsilon
            selected_index = randomizer.randrange(pool_size) if explored else 0
            adjusted_score, penalty, chosen = adjusted[selected_index]

            if selected_index == 0:
                propensity = (1.0 - epsilon) + epsilon / float(pool_size)
            else:
                propensity = epsilon / float(pool_size)
            reasons = list(chosen.reason_codes)
            if penalty > 0:
                reasons.append("diversity_artist_repeat")
            if explored:
                reasons.append("bounded_exploration")

            selected.append(
                RankedItem(
                    track_id=chosen.candidate.track_id,
                    rank=len(selected) + 1,
                    score=clamp(adjusted_score),
                    base_score=chosen.base_score,
                    learned_score=chosen.learned_score,
                    reason_codes=tuple(dict.fromkeys(reasons)),
                    propensity=propensity,
                    features=chosen.features,
                    candidate_snapshot=chosen.candidate.snapshot(),
                )
            )
            artist = chosen.candidate.primary_artist
            artist_counts[artist] = artist_counts.get(artist, 0) + 1
            remaining.remove(chosen)
        return selected

    def feedback(
        self,
        *,
        workspace_id: str,
        request_id: str,
        track_id: str,
        action: str,
        actor_id: str,
        actor_role: str,
        event_id: Optional[str] = None,
        target_playlist_id: Optional[str] = None,
        occurred_at: Optional[Any] = None,
    ) -> FeedbackResult:
        normalized_action = normalize_text(action).replace(" ", "_")
        if normalized_action not in ALLOWED_ACTIONS:
            raise DomainError(
                "action must be one of: %s" % ", ".join(sorted(ALLOWED_ACTIONS))
            )
        if normalized_action in {"add", "added"} and not (
            target_playlist_id and target_playlist_id.strip()
        ):
            raise DomainError("target_playlist_id is required for add feedback")
        if not actor_id or not actor_id.strip():
            raise DomainError("actor_id is required")
        if not actor_role or not actor_role.strip():
            raise DomainError("actor_role is required")
        resolved_time = (
            parse_datetime(occurred_at, field_name="occurred_at")
            if occurred_at is not None
            else utc_now()
        )
        return self.store.record_feedback(
            workspace_id=workspace_id.strip(),
            request_id=request_id.strip(),
            track_id=track_id.strip(),
            action=normalized_action,
            event_id=event_id,
            target_playlist_id=target_playlist_id,
            actor_id=actor_id,
            actor_role=actor_role,
            max_actor_events_per_hour=self.config.max_actor_events_per_hour,
            occurred_at=resolved_time,
        )

    def _training_examples(self, workspace_id: str) -> List[TrainingExample]:
        latest_by_item: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for row in self.store.feedback_rows(
            workspace_id, limit=self.config.max_training_events
        ):
            action = str(row["action"])
            if action not in POSITIVE_ACTIONS and action not in NEGATIVE_ACTIONS:
                continue
            if (
                action in {"add", "added"}
                and row.get("target_playlist_id")
                and row.get("target_playlist_id") != row.get("impression_playlist_id")
            ):
                # The action remains in the audit log, but adding to a different
                # playlist is not evidence of fit for the recommended playlist.
                continue
            latest_by_item[(str(row["request_id"]), str(row["track_id"]))] = row

        examples: List[TrainingExample] = []
        for row in latest_by_item.values():
            action = str(row["action"])
            label = 1 if action in POSITIVE_ACTIONS else 0
            action_weight = POSITIVE_ACTIONS.get(action, NEGATIVE_ACTIONS.get(action, 1.0))
            propensity = max(0.01, min(1.0, float(row.get("propensity") or 1.0)))
            inverse_propensity = min(self.config.max_propensity_weight, 1.0 / propensity)
            examples.append(
                TrainingExample(
                    features={
                        str(key): float(value)
                        for key, value in json.loads(row["features_json"]).items()
                    },
                    label=label,
                    weight=action_weight * inverse_propensity,
                    # Server ingestion time is the only trusted ordering key
                    # for temporal training. Client occurred_at is audit data.
                    occurred_at=parse_datetime(row["server_created_at"]),
                    base_probability=score_to_probability(float(row["base_score"])),
                    group_id=str(row["request_id"]),
                )
            )
        return sorted(examples, key=lambda example: example.occurred_at)

    def run_maintenance(
        self,
        workspace_id: Optional[str] = None,
        *,
        dry_run: bool = False,
        trigger_name: str = "api",
    ) -> Dict[str, Any]:
        if not self._maintenance_lock.acquire(blocking=False):
            raise DomainError("maintenance is already running")
        try:
            workspaces = (
                [workspace_id.strip()]
                if workspace_id and workspace_id.strip()
                else self.store.list_workspaces(
                    limit=self.config.max_workspaces_per_run
                )
            )
            if not workspaces:
                run_id = self.store.start_maintenance("__all__", trigger_name)
                run = self.store.finish_maintenance(
                    run_id,
                    status="skipped",
                    guardrails={"has_workspaces": False},
                )
                return {"runs": [run], "promoted": 0}

            runs = [
                self._maintain_workspace(
                    target, dry_run=dry_run, trigger_name=trigger_name
                )
                for target in workspaces
            ]
            return {
                "runs": runs,
                "promoted": sum(1 for run in runs if run.get("promoted")),
            }
        finally:
            self._maintenance_lock.release()

    def _maintain_workspace(
        self, workspace_id: str, *, dry_run: bool, trigger_name: str
    ) -> Dict[str, Any]:
        run_id = self.store.start_maintenance(workspace_id, trigger_name)
        try:
            examples = self._training_examples(workspace_id)
            positives = sum(example.label for example in examples)
            negatives = len(examples) - positives
            initial_guardrails = {
                "minimum_examples": len(examples) >= self.config.min_training_examples,
                "minimum_positive": positives >= self.config.min_examples_per_class,
                "minimum_negative": negatives >= self.config.min_examples_per_class,
            }
            if not all(initial_guardrails.values()):
                return self.store.finish_maintenance(
                    run_id,
                    status="skipped",
                    examples_count=len(examples),
                    guardrails=initial_guardrails,
                    metrics={"positive_examples": positives, "negative_examples": negatives},
                )

            active = self.store.ensure_baseline(workspace_id)
            validation_count: Optional[int] = None
            if active.kind == "logistic" and active.training_end is not None:
                new_examples = [
                    example
                    for example in examples
                    if example.occurred_at > active.training_end
                ]
                new_positives = sum(example.label for example in new_examples)
                new_negatives = len(new_examples) - new_positives
                new_data_guardrails = {
                    "new_examples_since_champion": len(new_examples)
                    >= self.config.min_examples_per_class * 2,
                    "new_positive_since_champion": new_positives
                    >= self.config.min_examples_per_class,
                    "new_negative_since_champion": new_negatives
                    >= self.config.min_examples_per_class,
                }
                if not all(new_data_guardrails.values()):
                    return self.store.finish_maintenance(
                        run_id,
                        status="skipped",
                        examples_count=len(examples),
                        guardrails={**initial_guardrails, **new_data_guardrails},
                        metrics={
                            "new_examples": len(new_examples),
                            "new_positive": new_positives,
                            "new_negative": new_negatives,
                        },
                    )
                # The latest half of newly observed examples is an unseen,
                # point-in-time holdout for both champion and challenger.
                validation_count = max(2, len(new_examples) // 2)

            temporal = train_with_temporal_holdout(
                examples,
                validation_fraction=self.config.validation_fraction,
                validation_count=validation_count,
            )
            candidate_metrics = temporal.metrics["candidate"]
            baseline_metrics = temporal.metrics["baseline"]
            champion_metrics = baseline_metrics
            champion_artifact_valid = True
            if active.kind == "logistic":
                try:
                    champion = LogisticModel.from_json(active.artifact_json)
                    validation_labels = [
                        example.label for example in temporal.validation
                    ]
                    champion_metrics = classification_metrics(
                        validation_labels,
                        [
                            champion.predict_probability(example.features)
                            for example in temporal.validation
                        ],
                    )
                except (TypeError, ValueError, json.JSONDecodeError):
                    # Recover against the safe heuristic baseline; a passing
                    # candidate can retire the corrupt active artifact.
                    champion_artifact_valid = False
                    champion_metrics = baseline_metrics
            temporal.metrics["champion"] = champion_metrics
            temporal.metrics["champion_artifact_valid"] = champion_artifact_valid
            if (
                temporal.metrics["validation_positive"] == 0
                or temporal.metrics["validation_negative"] == 0
            ):
                return self.store.finish_maintenance(
                    run_id,
                    status="skipped",
                    examples_count=len(examples),
                    guardrails={
                        **initial_guardrails,
                        "validation_has_both_classes": False,
                    },
                    metrics=temporal.metrics,
                )
            guardrails = dict(initial_guardrails)
            guardrails.update(
                {
                    "validation_has_both_classes": (
                        temporal.metrics["validation_positive"] > 0
                        and temporal.metrics["validation_negative"] > 0
                    ),
                    "auc_floor": candidate_metrics["auc"] >= 0.55,
                    "brier_not_regressed": (
                        candidate_metrics["brier"] <= baseline_metrics["brier"] + 0.02
                    ),
                    "log_loss_not_regressed": (
                        candidate_metrics["log_loss"]
                        <= baseline_metrics["log_loss"] + 0.05
                    ),
                    "ranking_signal_improved": (
                        candidate_metrics["auc"] > baseline_metrics["auc"] + 0.005
                        or candidate_metrics["brier"]
                        < baseline_metrics["brier"] - 0.005
                    ),
                    "champion_not_regressed": (
                        candidate_metrics["auc"] >= champion_metrics["auc"] - 0.005
                        and candidate_metrics["brier"]
                        <= champion_metrics["brier"] + 0.005
                    ),
                    "champion_improved": (
                        active.kind != "logistic"
                        or not champion_artifact_valid
                        or candidate_metrics["auc"]
                        > champion_metrics["auc"] + 0.005
                        or candidate_metrics["brier"]
                        < champion_metrics["brier"] - 0.005
                    ),
                }
            )

            production_model = LogisticModel.fresh()
            production_model.partial_fit(examples)
            artifact = production_model.to_json()
            digest = hashlib.sha256(artifact.encode("utf-8")).hexdigest()[:10]
            version = "logistic-v1-%s-%s" % (
                utc_now().strftime("%Y%m%d%H%M%S%f"),
                digest,
            )
            self.store.register_candidate(
                workspace_id=workspace_id,
                version=version,
                artifact_json=artifact,
                metrics=temporal.metrics,
                training_start=examples[0].occurred_at,
                training_end=examples[-1].occurred_at,
            )
            should_promote = all(guardrails.values()) and not dry_run
            if should_promote:
                self.store.promote_model(workspace_id, version)
            else:
                self.store.reject_model(workspace_id, version)
            return self.store.finish_maintenance(
                run_id,
                status="completed",
                examples_count=len(examples),
                candidate_version=version,
                promoted=should_promote,
                guardrails=guardrails,
                metrics=temporal.metrics,
            )
        except Exception as exc:
            self.store.finish_maintenance(
                run_id,
                status="failed",
                error_message=str(exc)[:1000],
            )
            raise


def default_editorial_path() -> str:
    filename = "rap_trap_br_2021_2026.json"
    candidates = [
        Path(__file__).resolve().parents[2] / "data" / filename,
        Path.cwd() / "services" / "playlists_ai_agent" / "data" / filename,
        Path.cwd() / "data" / filename,
        Path(sys.prefix) / "share" / "playlists_ai_agent" / filename,
        Path("/app/data") / filename,
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return str(candidates[0])


def _requires_durable_store() -> bool:
    vercel = os.getenv("VERCEL", "").strip().lower()
    if vercel in {"1", "true", "yes"}:
        return True
    vercel_environment = os.getenv("VERCEL_ENV", "").strip().lower()
    if vercel_environment in {"production", "preview"}:
        return True
    agent_environment = os.getenv("PLAYLISTS_AI_ENV", "").strip().lower()
    return agent_environment in {"prod", "production", "preview", "staging"}


def build_default_store() -> AgentStore:
    requested = os.getenv("PLAYLISTS_AI_STORE", "").strip().lower()
    if requested not in {"", "sqlite", "supabase"}:
        raise SupabaseConfigurationError(
            "PLAYLISTS_AI_STORE must be either sqlite or supabase"
        )

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    legacy_service_role_key = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY", ""
    ).strip()
    server_key = secret_key or legacy_service_role_key
    durable_required = _requires_durable_store()
    if durable_required and requested == "sqlite":
        raise SupabaseConfigurationError(
            "SQLite persistence is not allowed in a production or Vercel runtime"
        )

    use_supabase = (
        requested == "supabase"
        or durable_required
        or (requested == "" and bool(supabase_url or server_key))
    )
    if use_supabase:
        if not supabase_url or not server_key:
            raise SupabaseConfigurationError(
                "Supabase persistence requires NEXT_PUBLIC_SUPABASE_URL and "
                "SUPABASE_SECRET_KEY (recommended) or "
                "SUPABASE_SERVICE_ROLE_KEY (legacy)"
            )
        return SupabaseDataApiStore(
            supabase_url,
            server_key,
            timeout_seconds=_env_float(
                "PLAYLISTS_AI_SUPABASE_TIMEOUT_SECONDS", 8.0
            ),
            max_attempts=_env_int("PLAYLISTS_AI_SUPABASE_MAX_ATTEMPTS", 3),
            page_size=_env_int("PLAYLISTS_AI_SUPABASE_PAGE_SIZE", 500),
        )

    database_path = os.getenv(
        "PLAYLISTS_AI_DB_PATH",
        str(Path.cwd() / "data" / "playlists-ai-agent.db"),
    )
    return SQLiteStore(database_path)


def build_default_service() -> PlaylistsAiService:
    editorial_path = os.getenv("PLAYLISTS_AI_EDITORIAL_SEED", default_editorial_path())
    return PlaylistsAiService(
        build_default_store(),
        config=AgentConfig.from_env(),
        editorial=EditorialKnowledge.load(editorial_path),
    )
