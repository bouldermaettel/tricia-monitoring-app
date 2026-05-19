#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_URL="postgresql+psycopg://monitoring:monitoring@127.0.0.1:5432/monitoring"

usage() {
  cat <<'EOF'
Usage: ./dev-postgres.sh <command>

Commands:
  up            Start local Postgres container and wait until ready.
  down          Stop local Postgres container.
  reset-db      Recreate local Postgres volume from scratch.
  migrate       Run Alembic migrations against local Postgres.
  backend       Run backend locally with .venv against local Postgres.
  frontend      Run frontend locally with Vite dev server.
  status        Show container status and DB readiness.

Notes:
  - Uses docker compose service "postgres" from docker-compose.yml.
  - Keeps backend/frontend on host for fast feedback (no image push/build loop).
  - If Alembic fails due legacy SQLite-first migration defaults, backend startup
    still creates/patches schema automatically.
EOF
}

require_venv() {
  if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
    echo "Missing virtual environment at $ROOT_DIR/.venv"
    echo "Create it first, then install backend dependencies."
    exit 1
  fi
}

wait_for_postgres() {
  local tries=30
  local i
  for i in $(seq 1 "$tries"); do
    if docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U monitoring -d monitoring >/dev/null 2>&1; then
      echo "Postgres is ready."
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready in time."
  return 1
}

cmd="${1:-}"

case "$cmd" in
  up)
    docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres
    wait_for_postgres
    ;;
  down)
    docker compose -f "$ROOT_DIR/docker-compose.yml" stop postgres
    ;;
  reset-db)
    docker compose -f "$ROOT_DIR/docker-compose.yml" down -v
    docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres
    wait_for_postgres
    ;;
  migrate)
    require_venv
    if ! PYTHONPATH="$ROOT_DIR/backend" DATABASE_URL="$DB_URL" \
      "$ROOT_DIR/.venv/bin/alembic" -c "$ROOT_DIR/backend/alembic.ini" upgrade head; then
      echo "Alembic migration failed. Continuing is safe for local dev because"
      echo "backend startup runs Base.metadata.create_all + compatibility patches."
    fi
    ;;
  backend)
    require_venv
    PYTHONPATH="$ROOT_DIR/backend" DATABASE_URL="$DB_URL" APP_ENV=local CORS_ORIGINS=http://localhost:5173 \
      "$ROOT_DIR/.venv/bin/python" -m uvicorn src.main:app --reload
    ;;
  frontend)
    cd "$ROOT_DIR/frontend"
    npm run dev
    ;;
  status)
    docker compose -f "$ROOT_DIR/docker-compose.yml" ps postgres
    docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U monitoring -d monitoring || true
    ;;
  *)
    usage
    exit 1
    ;;
esac
