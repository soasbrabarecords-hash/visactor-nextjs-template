"""Dependency-free hybrid baseline and incremental logistic learner."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from .domain import Candidate, clamp, normalize_text


FEATURE_NAMES = (
    "bias",
    "opportunity",
    "fit",
    "heat",
    "momentum",
    "freshness",
    "stability",
    "inverse_saturation",
    "crossover",
    "position_strength",
    "movement_7d",
    "observed_days_30",
    "is_new_entry",
    "genre_match",
    "market_match",
    "editorial_prior",
)


def _unit(value: float) -> float:
    return clamp(value) / 100.0


def build_features(
    candidate: Candidate,
    *,
    playlist_genre: str,
    playlist_market: str,
    editorial_bonus: float = 0.0,
) -> Dict[str, float]:
    if candidate.current_position is None:
        position_strength = 0.5
    else:
        position_strength = max(0.0, min(1.0, (201.0 - candidate.current_position) / 200.0))
    movement = candidate.movement_7d if candidate.movement_7d is not None else 0.0
    normalized_movement = max(0.0, min(1.0, 0.5 + movement / 100.0))
    requested_genre = normalize_text(playlist_genre)
    candidate_genre = normalize_text(candidate.genre)
    requested_market = (playlist_market or "").upper()

    return {
        "bias": 1.0,
        "opportunity": _unit(candidate.opportunity),
        "fit": _unit(candidate.fit),
        "heat": _unit(candidate.heat),
        "momentum": _unit(candidate.momentum),
        "freshness": _unit(candidate.freshness),
        "stability": _unit(candidate.stability),
        "inverse_saturation": 1.0 - _unit(candidate.saturation),
        "crossover": _unit(candidate.crossover),
        "position_strength": position_strength,
        "movement_7d": normalized_movement,
        "observed_days_30": max(0.0, min(1.0, candidate.observed_days_30 / 30.0)),
        "is_new_entry": 1.0 if candidate.is_new_entry else 0.0,
        "genre_match": (
            1.0
            if requested_genre and requested_genre == candidate_genre
            else 0.5
            if requested_genre in {"", "desconhecido", "unknown"}
            else 0.0
        ),
        "market_match": (
            1.0
            if requested_market in {"", "BOTH"} or requested_market == candidate.market.upper()
            else 0.0
        ),
        "editorial_prior": max(0.0, min(1.0, editorial_bonus / 7.0)),
    }


def baseline_score(candidate: Candidate, editorial_bonus: float = 0.0) -> float:
    supplied_baseline = candidate.extra.get("baseline_score")
    if supplied_baseline is not None:
        score = clamp(supplied_baseline)
    else:
        # Exact parity with the current TypeScript recommendation baseline.
        score = 0.68 * candidate.opportunity + 0.32 * candidate.fit
    return clamp(score + max(0.0, min(7.0, editorial_bonus)))


def sigmoid(value: float) -> float:
    if value >= 0:
        exponent = math.exp(-min(value, 60.0))
        return 1.0 / (1.0 + exponent)
    exponent = math.exp(max(value, -60.0))
    return exponent / (1.0 + exponent)


@dataclass(frozen=True)
class TrainingExample:
    features: Dict[str, float]
    label: int
    weight: float
    occurred_at: datetime
    base_probability: float
    group_id: str = ""


@dataclass
class LogisticModel:
    weights: Dict[str, float]

    @classmethod
    def fresh(cls) -> "LogisticModel":
        return cls({name: 0.0 for name in FEATURE_NAMES})

    @classmethod
    def from_json(cls, value: str) -> "LogisticModel":
        payload = json.loads(value or "{}")
        if not isinstance(payload, dict):
            raise ValueError("model artifact must be a JSON object")
        raw_weights = payload.get("weights", payload)
        if not isinstance(raw_weights, dict):
            raise ValueError("model weights must be a JSON object")
        weights: Dict[str, float] = {}
        for name in FEATURE_NAMES:
            weight = float(raw_weights.get(name, 0.0))
            if not math.isfinite(weight):
                raise ValueError("model weight %s must be finite" % name)
            weights[name] = weight
        return cls(weights)

    def to_json(self) -> str:
        return json.dumps({"weights": self.weights}, sort_keys=True, separators=(",", ":"))

    def predict_probability(self, features: Mapping[str, float]) -> float:
        linear = sum(self.weights.get(name, 0.0) * float(features.get(name, 0.0)) for name in FEATURE_NAMES)
        return sigmoid(linear)

    def partial_fit(
        self,
        examples: Sequence[TrainingExample],
        *,
        epochs: int = 24,
        learning_rate: float = 0.08,
        l2: float = 0.001,
    ) -> None:
        ordered = sorted(examples, key=lambda example: example.occurred_at)
        for epoch in range(max(1, epochs)):
            rate = learning_rate / (1.0 + epoch * 0.08)
            for example in ordered:
                prediction = self.predict_probability(example.features)
                error = (float(example.label) - prediction) * max(0.1, example.weight)
                for name in FEATURE_NAMES:
                    value = float(example.features.get(name, 0.0))
                    regularization = 0.0 if name == "bias" else l2 * self.weights[name]
                    self.weights[name] += rate * (error * value - regularization)


def binary_auc(labels: Sequence[int], probabilities: Sequence[float]) -> float:
    positive_count = sum(1 for label in labels if label == 1)
    negative_count = len(labels) - positive_count
    if positive_count == 0 or negative_count == 0:
        return 0.5
    ordered = sorted(zip(probabilities, labels), key=lambda item: item[0])
    positive_rank_sum = 0.0
    index = 0
    while index < len(ordered):
        end = index + 1
        while end < len(ordered) and ordered[end][0] == ordered[index][0]:
            end += 1
        average_rank = ((index + 1) + end) / 2.0
        positive_rank_sum += average_rank * sum(
            label for _, label in ordered[index:end]
        )
        index = end
    return (
        positive_rank_sum - positive_count * (positive_count + 1) / 2.0
    ) / float(positive_count * negative_count)


def score_to_probability(score: float) -> float:
    """Calibrate a 0..100 ranking score without treating it as a probability."""
    return sigmoid((clamp(score) - 50.0) / 15.0)


def classification_metrics(
    labels: Sequence[int], probabilities: Sequence[float]
) -> Dict[str, float]:
    if not labels:
        return {"auc": 0.5, "brier": 1.0, "log_loss": 10.0, "accuracy": 0.0}
    clipped = [min(1.0 - 1e-9, max(1e-9, probability)) for probability in probabilities]
    count = float(len(labels))
    brier = sum((probability - label) ** 2 for label, probability in zip(labels, clipped)) / count
    log_loss = -sum(
        label * math.log(probability) + (1 - label) * math.log(1.0 - probability)
        for label, probability in zip(labels, clipped)
    ) / count
    accuracy = sum(
        1 for label, probability in zip(labels, clipped) if (probability >= 0.5) == bool(label)
    ) / count
    return {
        "auc": round(binary_auc(labels, clipped), 6),
        "brier": round(brier, 6),
        "log_loss": round(log_loss, 6),
        "accuracy": round(accuracy, 6),
    }


@dataclass(frozen=True)
class TemporalTrainingResult:
    model: LogisticModel
    metrics: Dict[str, Any]
    validation_examples: int
    validation: Tuple[TrainingExample, ...]


def train_with_temporal_holdout(
    examples: Sequence[TrainingExample],
    *,
    validation_fraction: float = 0.2,
    validation_count: Optional[int] = None,
) -> TemporalTrainingResult:
    ordered = sorted(examples, key=lambda example: example.occurred_at)
    if len(ordered) < 2:
        raise ValueError("at least two examples are required")
    target_validation_count = (
        max(1, int(validation_count))
        if validation_count is not None
        else max(1, int(round(len(ordered) * validation_fraction)))
    )
    target_validation_count = min(target_validation_count, len(ordered) - 1)

    # Keep all feedback from one recommendation request in the same temporal
    # fold. Empty group IDs are treated as unique legacy examples.
    group_map: Dict[str, List[TrainingExample]] = {}
    for index, example in enumerate(ordered):
        group_id = example.group_id or "__event_%d" % index
        group_map.setdefault(group_id, []).append(example)
    # A request is ordered by its latest server-side event. This prevents an
    # interleaved early event from placing a group in train while a later event
    # from that same request falls after validation groups.
    grouped = sorted(
        group_map.values(),
        key=lambda group: max(example.occurred_at for example in group),
    )
    validation_groups: List[List[TrainingExample]] = []
    validation_size = 0
    while len(grouped) > 1 and validation_size < target_validation_count:
        group = grouped.pop()
        validation_groups.insert(0, group)
        validation_size += len(group)
    train_examples = [example for group in grouped for example in group]
    validation_examples = [
        example for group in validation_groups for example in group
    ]

    model = LogisticModel.fresh()
    model.partial_fit(train_examples)
    labels = [example.label for example in validation_examples]
    learned_probabilities = [
        model.predict_probability(example.features) for example in validation_examples
    ]
    baseline_probabilities = [example.base_probability for example in validation_examples]
    metrics: Dict[str, Any] = {
        "train_examples": len(train_examples),
        "validation_examples": len(validation_examples),
        "train_groups": len(grouped),
        "validation_groups": len(validation_groups),
        "positive_examples": sum(example.label for example in ordered),
        "negative_examples": len(ordered) - sum(example.label for example in ordered),
        "validation_positive": sum(labels),
        "validation_negative": len(labels) - sum(labels),
        "candidate": classification_metrics(labels, learned_probabilities),
        "baseline": classification_metrics(labels, baseline_probabilities),
    }
    return TemporalTrainingResult(
        model, metrics, len(validation_examples), tuple(validation_examples)
    )
