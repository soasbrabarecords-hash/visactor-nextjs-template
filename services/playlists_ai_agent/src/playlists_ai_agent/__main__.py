from __future__ import annotations

import os


def main() -> None:
    import uvicorn

    uvicorn.run(
        "playlists_ai_agent.api:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )


if __name__ == "__main__":
    main()

