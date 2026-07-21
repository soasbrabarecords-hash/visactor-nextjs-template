"""Vercel ASGI entrypoint for the src-layout package."""

from pathlib import Path
import sys


SOURCE_ROOT = Path(__file__).resolve().parent / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from playlists_ai_agent.api import app  # noqa: E402


__all__ = ["app"]
