# Tricia Monitoring App Architecture

## Overview

The Tricia Monitoring App is a two-tier web application built with a Python FastAPI backend and a React + Vite frontend. The application is deployed as containerized workloads in Azure Container Apps, with PostgreSQL as the primary database and Log Analytics for centralized logging.

## Backend

- Language: Python 3.11+
- Web framework: FastAPI
- ASGI server: Uvicorn
- Database ORM: SQLAlchemy
- Database migrations: Alembic
- Database driver: `psycopg[binary]`
- Configuration: `pydantic-settings`

### Backend responsibilities

- Expose REST API endpoints for monitoring data import, review, classification, and user management
- Handle authentication and session flows
- Run database migrations on startup when a real PostgreSQL URL is configured
- Accept configuration and secrets through environment variables

### Authentication

- Login uses `/api/v1/auth/session` to validate username/password and issue JWT access and refresh tokens
- Access tokens are short-lived and used for API authorization via `Authorization: Bearer <token>`
- Refresh tokens are used to obtain new access tokens via `/api/v1/auth/refresh`
- Password updates are supported through `/api/v1/auth/change-password`
- The backend validates tokens and enforces active user state before allowing protected operations

### Backend runtime environment

- Containerized image built from `backend/Dockerfile`
- Deployed as an Azure Container App with HTTPS ingress
- Environment variables set from Bicep deployment, including:
  - `DATABASE_URL`
  - `SECRET_KEY`
  - `CORS_ORIGINS`
  - `BOOTSTRAP_ADMIN_USERNAME`
  - `BOOTSTRAP_ADMIN_PASSWORD`
  - `BOOTSTRAP_ADMIN_DISPLAY_NAME`

## Frontend

- Framework: React
- Language: TypeScript
- Bundler: Vite
- Styling: Tailwind CSS
- State management and data fetching:
  - `@tanstack/react-query`
  - `zustand`
- Form handling: `react-hook-form`
- Validation: `zod`
- HTTP client: `axios`

### Frontend responsibilities

- Provide user interface for importing files, reviewing cases, and configuring thresholds
- Send authenticated requests to the backend API
- Enforce browser-side validation and present data summaries

### Frontend runtime environment

- Containerized image built from `frontend/Dockerfile`
- Deployed as an Azure Container App with HTTP ingress
- Uses configured CORS origins to allow frontend-backend communication

## Infrastructure and deployment

The legacy namespace deployment is defined in `infra/archive/main.bicep` and orchestrated by `deploy.sh`. The current live prod/dev application configuration is defined in `infra/live/main.bicep` and orchestrated by `deploy-live.sh`. The main Azure resources are:

- Azure Log Analytics workspace (`Microsoft.OperationalInsights/workspaces`)
- Existing Azure Container Registry (`Microsoft.ContainerRegistry/registries`)
- Azure Database for PostgreSQL Flexible Server (`Microsoft.DBforPostgreSQL/flexibleServers`)
- PostgreSQL database resource (`Microsoft.DBforPostgreSQL/flexibleServers/databases`)
- PostgreSQL firewall rule to allow Azure services
- Azure Container Apps managed environment (`Microsoft.App/managedEnvironments`)
- Azure Container Apps for backend and frontend (`Microsoft.App/containerApps`)

### Deployment flow

1. Build backend and frontend container images and push them to ACR.
2. Deploy legacy infrastructure using `infra/archive/main.bicep` and the parameter file `infra/parameters.json`.
3. Azure Container Apps pull the images from ACR and start the backend and frontend services.
4. The backend service connects to the PostgreSQL Flexible Server using the injected `DATABASE_URL` secret.
5. Logs are forwarded to Azure Log Analytics via the Container Apps environment.

## Data flow

1. User interacts with the frontend in the browser.
2. Frontend sends API calls to the backend container app.
3. Backend authenticates and validates requests.
4. Backend reads/writes data to PostgreSQL.
5. Backend logs application events to Azure Log Analytics.

## Security and configuration

- Secrets are injected into the backend container app as environment variables and container app secrets.
- Real secret values should not be committed to version control.
- CORS is configured via `corsOrigins` passed from the deployment parameters.
- The PostgreSQL server is created with public access enabled and a firewall rule allowing Azure service access.

## Key repository files

- `backend/pyproject.toml` — backend dependencies and packaging
- `backend/Dockerfile` — backend container image build
- `frontend/package.json` — frontend dependencies and scripts
- `frontend/Dockerfile` — frontend container image build
- `infra/archive/main.bicep` — legacy infrastructure definition
- `infra/parameters.json` — legacy deployment parameters example
- `docs/deployment.md` — deployment and verification guide
- `README.md` — development and deployment overview
