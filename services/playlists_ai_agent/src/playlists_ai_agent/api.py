"""FastAPI transport for the dependency-free Playlists IA core."""

from __future__ import annotations

import os
import secrets
from typing import Any, Dict, List, Optional, Union

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .domain import Candidate, DomainError, NotFoundError, RankRequest
from .service import PlaylistsAiService, build_default_service


def _production_environment() -> bool:
    vercel_environment = os.getenv("VERCEL_ENV", "").strip().lower()
    agent_environment = os.getenv("PLAYLISTS_AI_ENV", "").strip().lower()
    return vercel_environment == "production" or agent_environment in {
        "prod",
        "production",
    }


def _docs_enabled() -> bool:
    if _production_environment():
        return False
    configured = os.getenv("PLAYLISTS_AI_ENABLE_DOCS", "").strip().lower()
    if configured:
        return configured in {"1", "true", "yes"}
    return True


class ApiModel(BaseModel):
    class Config:
        extra = "ignore"


class CandidateInput(ApiModel):
    track_id: str
    name: str
    artists: Union[str, List[str]]
    genre: Optional[str] = None
    market: Optional[str] = None

    opportunity: Optional[float] = None
    opportunity_score: Optional[float] = None
    fit: Optional[float] = None
    baseline_fit_score: Optional[float] = None
    playlist_fit: Optional[Any] = None
    heat: Optional[float] = None
    heat_score: Optional[float] = None
    momentum: Optional[float] = None
    momentum_score: Optional[float] = None
    freshness: Optional[float] = None
    freshness_score: Optional[float] = None
    stability: Optional[float] = None
    stability_score: Optional[float] = None
    saturation: Optional[float] = None
    saturation_risk: Optional[float] = None
    crossover: Optional[float] = None
    crossover_score: Optional[float] = None
    baseline_score: Optional[float] = None

    current_position: Optional[int] = None
    movement_7d: Optional[float] = None
    observed_days_30: Optional[int] = None
    is_new_entry: Optional[bool] = None
    positions: Optional[Dict[str, Any]] = None
    genre_confidence: Optional[float] = None

    @staticmethod
    def _first(*values: Any, default: float = 50.0) -> Any:
        for value in values:
            if value is not None:
                return value
        return default

    @staticmethod
    def _fit_value(value: Any) -> Any:
        if isinstance(value, dict):
            return value.get("score")
        return value

    def to_domain(self) -> Candidate:
        return Candidate.build(
            track_id=self.track_id,
            name=self.name,
            artists=self.artists,
            genre=self.genre,
            market=self.market,
            opportunity=self._first(self.opportunity, self.opportunity_score),
            fit=self._first(
                self.fit,
                self.baseline_fit_score,
                self._fit_value(self.playlist_fit),
            ),
            heat=self._first(self.heat, self.heat_score),
            momentum=self._first(self.momentum, self.momentum_score),
            freshness=self._first(self.freshness, self.freshness_score),
            stability=self._first(self.stability, self.stability_score),
            saturation=self._first(self.saturation, self.saturation_risk),
            crossover=self._first(self.crossover, self.crossover_score, default=0.0),
            current_position=self.current_position,
            movement_7d=self.movement_7d,
            observed_days_30=self.observed_days_30 or 0,
            is_new_entry=bool(self.is_new_entry),
            extra={
                "baseline_score": self.baseline_score,
                "positions": self.positions,
                "genre_confidence": self.genre_confidence,
            },
        )


class RankInput(ApiModel):
    workspace_id: str
    playlist_id: str
    playlist_name: str
    genre: Optional[str] = None
    market: Optional[str] = None
    as_of: str
    limit: int = Field(default=10, ge=1, le=100)
    candidates: List[CandidateInput]

    def to_domain(self) -> RankRequest:
        return RankRequest.build(
            workspace_id=self.workspace_id,
            playlist_id=self.playlist_id,
            playlist_name=self.playlist_name,
            genre=self.genre,
            market=self.market,
            as_of=self.as_of,
            limit=self.limit,
            candidates=[candidate.to_domain() for candidate in self.candidates],
        )


class RankedItemOutput(ApiModel):
    track_id: str
    rank: int
    score: float
    base_score: float
    learned_score: Optional[float]
    reason_codes: List[str]
    propensity: float


class RankOutput(ApiModel):
    request_id: str
    model_version: str
    personalized: bool
    cold_start: bool
    items: List[RankedItemOutput]


class FeedbackInput(ApiModel):
    workspace_id: str
    request_id: str
    track_id: str
    action: str
    event_id: Optional[str] = None
    occurred_at: Optional[str] = None
    target_playlist_id: Optional[str] = None
    actor_id: str
    actor_role: str


class MaintenanceInput(ApiModel):
    workspace_id: Optional[str] = None
    dry_run: bool = False


def create_app(
    service: Optional[PlaylistsAiService] = None,
    *,
    configured_token: Optional[str] = None,
) -> FastAPI:
    docs_enabled = _docs_enabled()
    application = FastAPI(
        title="Playlists IA Agent",
        version="0.1.0",
        docs_url="/docs" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
        redoc_url=None,
    )
    agent_service = service or build_default_service()
    token = (
        configured_token
        if configured_token is not None
        else (
            os.getenv("PLAYLISTS_AI_SERVICE_TOKEN", "").strip()
            or os.getenv("PLAYLISTS_AI_TOKEN", "").strip()
        )
    )
    allow_insecure_dev = os.getenv(
        "PLAYLISTS_AI_ALLOW_INSECURE_DEV", ""
    ).strip().lower() in {"1", "true", "yes"}

    def authenticate(
        supplied_token: Optional[str] = Header(
            default=None, alias="X-Playlists-AI-Token"
        ),
    ) -> None:
        if not token and not allow_insecure_dev:
            raise HTTPException(
                status_code=503, detail="service token not configured"
            )
        if token and (
            supplied_token is None
            or not secrets.compare_digest(token, supplied_token)
        ):
            raise HTTPException(status_code=401, detail="invalid service token")

    @application.get("/health", dependencies=[Depends(authenticate)])
    def health() -> Dict[str, Any]:
        result = agent_service.health()
        if result["status"] != "ok":
            raise HTTPException(status_code=503, detail=result)
        return result

    @application.post(
        "/v1/rank",
        response_model=RankOutput,
        dependencies=[Depends(authenticate)],
    )
    def rank(payload: RankInput) -> Dict[str, Any]:
        try:
            return agent_service.rank(payload.to_domain()).response()
        except DomainError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @application.post("/v1/feedback", dependencies=[Depends(authenticate)])
    def feedback(payload: FeedbackInput) -> Dict[str, Any]:
        try:
            result = agent_service.feedback(
                workspace_id=payload.workspace_id,
                request_id=payload.request_id,
                track_id=payload.track_id,
                action=payload.action,
                event_id=payload.event_id,
                occurred_at=payload.occurred_at,
                target_playlist_id=payload.target_playlist_id,
                actor_id=payload.actor_id,
                actor_role=payload.actor_role,
            )
            return {
                "event_id": result.event_id,
                "created": result.created,
                "action": result.action,
                "occurred_at": result.occurred_at.isoformat().replace(
                    "+00:00", "Z"
                ),
            }
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except DomainError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @application.post(
        "/v1/maintenance/run", dependencies=[Depends(authenticate)]
    )
    def maintenance(payload: Optional[MaintenanceInput] = None) -> Dict[str, Any]:
        try:
            return agent_service.run_maintenance(
                payload.workspace_id if payload else None,
                dry_run=payload.dry_run if payload else False,
                trigger_name="api",
            )
        except DomainError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return application


app = create_app()
