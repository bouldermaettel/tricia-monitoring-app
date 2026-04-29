# Quickstart: Monitoring Tool

## Local development

### Prerequisites
- Python 3.11+
- Node.js 20+
- `uv` for Python environment and dependency management
- SQLite for default local storage
- Docker optional for PostgreSQL compatibility testing

### Suggested repository layout
```text
backend/
frontend/
shared/
specs/001-monitoring-tool/
```

### Backend bootstrap
1. Create or reuse the project virtual environment:
   - `.venv/bin/python -m pip install -U pip`
2. Install backend dependencies:
   - `.venv/bin/python -m pip install fastapi uvicorn sqlalchemy alembic pydantic-settings psycopg[binary] pandas openpyxl python-multipart pytest httpx`
3. Configure local environment variables:
   - `DATABASE_URL=sqlite:///./data/tricia-monitoring.db`
   - `APP_ENV=local`
4. Run migrations.
5. Start the API server with auto-reload.

### Frontend bootstrap
1. Create the frontend app with Vite React TypeScript.
2. Install dependencies:
   - `react-router-dom`
   - `@tanstack/react-query`
   - `zustand`
   - `zod`
   - `react-hook-form`
   - `axios`
   - `vitest` and testing-library packages
3. Set `VITE_API_BASE_URL=http://localhost:8000/api`.
4. Start the Vite dev server.

## Runtime flows

### Input validation and save
1. Operator enters case values in the input dashboard.
2. Frontend sends `POST /api/v1/cases/validate`.
3. Backend checks duplicates, derives `analysis_date`, infers `user_id`, and returns autofill suggestions.
4. Operator confirms or adjusts values.
5. Frontend sends `POST /api/v1/cases` to persist the case.

### Matrix analysis
1. Analyst selects time range and filter options.
2. Frontend requests `GET /api/v1/matrices/confusion` and `GET /api/v1/cases` with matching filters.
3. Clicking a matrix cell updates shared filter state and reloads the case table.
4. Threshold configuration determines matrix cell highlighting.

### Import and export
1. User uploads CSV or Excel file through the import flow.
2. Backend validates each row and records job results.
3. Filtered datasets can be exported as CSV or Excel from analysis or control dashboards.

## Validation checklist
- Duplicate `vk_number` returns a conflict response with edit guidance.
- Save is blocked until validation succeeds.
- Excluded cases can be toggled in or out of aggregation results.
- Threshold updates affect future matrix responses without redeploying services.

## Deployment path

### Local
- Backend and frontend run as separate dev servers.
- SQLite is the default backing store.
- Create `backend/Dockerfile` and `frontend/Dockerfile` from the start; Azure Container Apps is the deployment target and container behaviour should be verifiable locally.
- Use `docker-compose.yml` at the repo root for full container-stack testing with PostgreSQL.

### Azure Container Apps (target)
- Build and deploy through `deploy.sh` (which calls `infra/main.bicep`).
- Deploy backend and frontend as separate ACA container apps.
- Database: Azure Database for PostgreSQL (Flexible Server) provisioned by Bicep.
- Inject all config via ACA environment variables or secrets — nothing baked into images.
- Runtime migrations are handled in backend startup (`backend/start.sh`) for non-SQLite `DATABASE_URL` values.
- Frontend served from a container (Nginx) or Azure Static Web Apps.

### Notes on infra templates
- `infra/main.bicep` is the canonical infrastructure definition.
- Files under `infra/aca/` are legacy reference examples and are not used by the current deploy path.

### Future scaling on ACA
- Set API minimum replicas to 1 to avoid cold starts.
- Add Azure Cache for Redis if matrix query volume demands caching.
- Offload large imports/exports to ACA jobs or a background worker container.
- Add Azure Blob Storage for export file retention if required.
