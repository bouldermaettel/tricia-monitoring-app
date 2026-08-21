# Infrastructure Runbook

This folder contains the Azure deployment source of truth for the monitoring app.

## Canonical files

- `main.bicep`: provisions Azure Container Apps environment, backend/frontend apps, and Azure Database for PostgreSQL Flexible Server.
- `parameters.example.json`: example input structure only.
- `parameters.json`: local operator convenience file (do not store real secrets in version control).

## What gets provisioned

- Azure Log Analytics workspace
- Azure Container Registry (existing, referenced)
- Azure Database for PostgreSQL Flexible Server and app database
- Azure Container Apps environment
- Backend and frontend Azure Container Apps

## Database behavior

- Azure deploy path is PostgreSQL only.
- `main.bicep` builds a URL-encoded PostgreSQL SQLAlchemy URL and stores it as the `database-url` secret.
- Backend app receives `DATABASE_URL` from that secret.
- Backend startup (`backend/start.sh`) runs Alembic for non-SQLite URLs, then starts Uvicorn.

## Deploy

1. Export required environment variables:
   - `SECRET_KEY`
   - `BOOTSTRAP_ADMIN_USERNAME`
   - `BOOTSTRAP_ADMIN_PASSWORD`
   - `POSTGRES_ADMIN_PASSWORD`
2. Run:
   - `./deploy.sh <namespace> [resource-group] [location]`

Optional tuning env vars:
- `POSTGRES_ADMIN_USERNAME` (default `triciaadmin`)
- `POSTGRES_DATABASE_NAME` (default `tricia_monitoring`)
- `POSTGRES_SKU_NAME` (default `Standard_B1ms`)
- `POSTGRES_SKU_TIER` (default `Burstable`)
- `POSTGRES_STORAGE_GB` (default `32`)
- `POSTGRES_VERSION` (default `16`)
- `BOOTSTRAP_ADMIN_DISPLAY_NAME` (default `System Admin`)
- `CORS_ORIGINS`

## Verification checklist

1. Confirm active backend revision is healthy:
   - `az containerapp revision list --name tricia-<namespace>-backend --resource-group <rg> --query "[?properties.active].{name:name,health:properties.healthState,traffic:properties.trafficWeight}" -o table`
2. Confirm backend endpoint responds:
   - `curl -sS -i https://<backend-fqdn>/docs | sed -n '1,20p'`
3. Confirm auth and import flows against deployed backend.
4. Check backend logs for migration startup messages and database connectivity.

## Troubleshooting notes

- URL-encoded credentials are supported; `main.bicep` uses URI encoding for postgres username/password.
- Alembic config interpolation with `%` is handled in `backend/src/db/migrations/env.py`.
- If migration fails at startup, backend logs a warning and continues booting.

## Security notes

- Do not commit real passwords or keys in `parameters.json`.
- Prefer CI/CD secrets, shell environment variables, or Key Vault-driven secret injection.
