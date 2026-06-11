# Tricia Monitoring App

Monitoring web application with FastAPI backend and Vite React TypeScript frontend.

## Database modes

- Local app runtime uses PostgreSQL only.
- SQLite is disabled for normal backend startup to avoid accidental local development against the wrong database.
- Test fixtures still use isolated SQLite in-memory databases.
- Azure deployment uses Azure Database for PostgreSQL Flexible Server provisioned from `infra/main.bicep`.
- In Azure, `DATABASE_URL` is injected into the backend container as a secret and backend startup runs Alembic migrations when available.

## Development

- Backend: `PYTHONPATH=backend .venv/bin/python -m uvicorn src.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Backend tests: `PYTHONPATH=backend .venv/bin/python -m pytest backend/tests -q`
- Frontend tests: `cd frontend && npm run test`

### Local Postgres Parity (No Image Push Loop)

Use local host processes for backend/frontend and only run Postgres in Docker. This matches production database behavior without rebuilding/pushing images.

1. Start Postgres container:
   - `./dev-postgres.sh up`
2. Optionally run migrations against local Postgres (best effort):
   - `./dev-postgres.sh migrate`
3. Start backend on host using `.venv` and Postgres:
   - `./dev-postgres.sh backend`
4. In another terminal, start frontend:
   - `./dev-postgres.sh frontend`

If migrations fail locally, continue with step 3. Backend startup creates and patches schema automatically.

Useful commands:

- Check status: `./dev-postgres.sh status`
- Reset local DB fully: `./dev-postgres.sh reset-db`
- Stop Postgres: `./dev-postgres.sh down`

Local Postgres URL used by the helper:

- `postgresql+psycopg://monitoring:monitoring@127.0.0.1:5432/monitoring`

### Restart backend after auth/security changes

1. Stop running backend process (for example: `pkill -f "uvicorn src.main:app"`).
2. Start backend again: `PYTHONPATH=backend .venv/bin/python -m uvicorn src.main:app --reload`.
3. Verify backend is reachable: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/docs`.

## Deployment

Deployment source of truth is:

- `deploy.sh` for build and deploy orchestration
- `infra/main.bicep` for infrastructure and Container Apps configuration

Files in `infra/aca/` are legacy examples and are not used by `deploy.sh`.

### Namespace-based sandbox deployment

This repository includes a namespace-isolated deployment flow (same sandbox, different namespace) similar to `infra_example`.

1. Export required secrets:
   - `SECRET_KEY`
   - `BOOTSTRAP_ADMIN_USERNAME`
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - `POSTGRES_ADMIN_PASSWORD`
2. Optional:
   - `POSTGRES_ADMIN_USERNAME` (default `triciaadmin`)
   - `POSTGRES_DATABASE_NAME` (default `tricia_monitoring`)
   - `POSTGRES_SKU_NAME` (default `Standard_B1ms`)
   - `POSTGRES_SKU_TIER` (default `Burstable`)
   - `POSTGRES_STORAGE_GB` (default `32`)
   - `POSTGRES_VERSION` (default `16`)
   - `BOOTSTRAP_ADMIN_DISPLAY_NAME`
   - `CORS_ORIGINS`
3. Run:
   - `./deploy.sh <namespace> [resource-group] [location]`

Example:

`./deploy.sh team-a monitoring-sandbox-rg switzerlandnorth`

### Post-deploy smoke checks

1. Check backend revision health:
   - `az containerapp revision list --name tricia-<namespace>-backend --resource-group <resource-group> --query "[?properties.active].{name:name,health:properties.healthState,traffic:properties.trafficWeight}" -o table`
2. Check auth endpoint:
   - `curl -sS -i -X POST "https://<backend-fqdn>/api/v1/auth/session" -H "Content-Type: application/json" -d '{"username":"<admin>","password":"<password>"}' | sed -n '1,20p'`
3. Check import endpoint:
   - `curl -sS -i -X POST "https://<backend-fqdn>/api/v1/imports" -H "Origin: https://<frontend-fqdn>" -H "x-actor-id: <actor-id>" -F "file=@/tmp/test_import.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | sed -n '1,40p'`

### Security note

Do not commit real secrets in `infra/parameters.json`. Prefer shell environment variables, CI secrets, or Key Vault-backed injection.


###
deployment:

`source env_deploy.sh && ./deploy.sh pretricia imdrf-code-prediction-pre-tricia-rg switzerlandnorth`