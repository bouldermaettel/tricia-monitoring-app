# Monitoring Tool Architecture

## Services

- FastAPI backend with modular routers and service layer.
- Vite + React frontend with TanStack Query and Zustand.
- SQLite for local runs; PostgreSQL-compatible SQLAlchemy model layer for deployment.

## Data Flow

1. Input dashboard validates case via API.
2. Case save persists normalized records and snapshots.
3. Matrix dashboard aggregates confusion data and supports case review updates.
4. Control dashboard reads delay buckets.
5. Import/export and threshold configuration are centrally managed by backend services.
6. User management allows admins to list and create users through `/api/v1/users`.
7. Admin session identity is established via `/api/v1/auth/session`, and user lifecycle operations include update/deactivate/delete.
8. Passwords are stored as PBKDF2 hashes, and the initial bootstrap admin is loaded from `config.yml`.
9. Access is protected by bearer access tokens and rotated refresh tokens, with frontend auto-refresh and single retry on 401.

## Operations

- Structured request IDs are emitted via request middleware.
- Alembic migrations manage schema (`backend/src/db/migrations/versions`).
- Deployment target is Azure Container Apps with ACR-backed images.
