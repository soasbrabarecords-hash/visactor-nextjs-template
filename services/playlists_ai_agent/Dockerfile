FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYLISTS_AI_DB_PATH=/data/playlists-ai-agent.db \
    PLAYLISTS_AI_EDITORIAL_SEED=/app/data/rap_trap_br_2021_2026.json

WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir . && mkdir -p /data

EXPOSE 8000
CMD ["uvicorn", "playlists_ai_agent.api:app", "--host", "0.0.0.0", "--port", "8000"]
