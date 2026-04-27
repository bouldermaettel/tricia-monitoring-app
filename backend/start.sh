#!/bin/sh
set -eu

database_url="${DATABASE_URL:-sqlite:///./data/tricia-monitoring.db}"

case "$database_url" in
  sqlite:*)
    echo "Starting backend with SQLite schema auto-create"
    ;;
  *)
    echo "Running Alembic migrations"
    alembic -c /app/backend/alembic.ini upgrade head
    ;;
esac

exec uvicorn src.main:app --host 0.0.0.0 --port 8000