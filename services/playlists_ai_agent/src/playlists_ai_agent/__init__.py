"""Learning and ranking core for Playlists IA."""

from .domain import Candidate, RankRequest
from .service import AgentConfig, PlaylistsAiService
from .store import SQLiteStore

__all__ = [
    "AgentConfig",
    "Candidate",
    "PlaylistsAiService",
    "RankRequest",
    "SQLiteStore",
]

__version__ = "0.1.0"

