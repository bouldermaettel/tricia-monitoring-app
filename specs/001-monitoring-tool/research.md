# Research: Monitoring Tool

## Backend architecture
- Decision: Use a layered FastAPI backend with thin routers, Pydantic schemas, SQLAlchemy models, and service modules for case workflows, matrix aggregation, filtering, import/export, and configuration.
- Rationale: This keeps HTTP concerns isolated from business logic, makes analytics behavior testable, and supports clean REST APIs consumed by a separate frontend.
- Alternatives considered: A single-file FastAPI app would be faster to start but would entangle validation, persistence, and aggregation logic; a heavier domain-driven structure is unnecessary for the current scope.

## Storage strategy
- Decision: Standardize on SQLAlchemy with SQLite for local development and PostgreSQL for shared and production environments, keeping queries vendor-neutral and managing schema changes with Alembic.
- Rationale: SQLite keeps local setup light, while PostgreSQL handles concurrent writes, indexing, and future scale. A shared ORM layer reduces divergence across environments.
- Alternatives considered: PostgreSQL-only development increases local setup cost; SQLite in production would become a write-concurrency bottleneck.

## Analytics and confusion matrix computation
- Decision: Perform filtering and aggregation in the database with grouped SQL queries, and use Pandas only for import/export shaping and heavier analytical transforms.
- Rationale: Database-side filtering scales better for interactive dashboards, avoids loading whole datasets into memory, and keeps matrix interactions responsive.
- Alternatives considered: Computing matrices directly in Pandas for every dashboard interaction would be simpler initially but would degrade with larger datasets and increase API latency.

## Frontend state management
- Decision: Use React with TanStack Query for server state and a lightweight client state store for dashboard filters, selected matrix cells, date range, and export options.
- Rationale: Server data and UI filter state have different lifecycles. Separating them simplifies cache invalidation and keeps matrix clicks, filter changes, and list refreshes predictable.
- Alternatives considered: Redux is heavier than needed; local component state would make cross-dashboard filter coordination harder.

## Import and export handling
- Decision: Accept CSV and Excel uploads through backend endpoints, validate rows against request schemas, and use Pandas with OpenPyXL for export generation.
- Rationale: Pandas provides robust tabular parsing and consistent output formatting, while backend validation ensures imports obey the same rules as manual entry.
- Alternatives considered: Pure client-side import/export would duplicate validation logic and struggle with larger files.

## Threshold configuration
- Decision: Store thresholds centrally in the database as versioned configuration records exposed through dedicated REST endpoints.
- Rationale: Central persistence ensures every dashboard uses the same acceptance logic and allows threshold changes without redeploying the application.
- Alternatives considered: File-based configuration is simpler but harder to audit and update at runtime.

## Validation workflow
- Decision: Use a two-step validate-then-save workflow, where validation checks duplicates, derives metadata, and previews auto-filled values before final persistence.
- Rationale: The workflow matches the source specification, reduces accidental duplicates, and gives operators immediate feedback without committing incomplete records.
- Alternatives considered: Single-step create requests would simplify the API but provide weaker duplicate handling and less operator guidance.

## Testing approach
- Decision: Use pytest for backend unit and integration tests, Vitest plus React Testing Library for frontend tests, and Docker-based PostgreSQL integration checks for compatibility.
- Rationale: This combination gives fast local feedback, validates service logic directly, and still exercises production-like database behavior before shipping.
- Alternatives considered: End-to-end-only testing would be slower and make failures harder to diagnose.

## Deployment path
- Decision: Develop locally with separate FastAPI and Vite dev servers backed by SQLite, then move to containerized deployment with PostgreSQL, reverse proxying, and horizontally scalable API workers.
- Rationale: The stack starts simple and retains a clear path to managed Postgres, object storage for exports, and async workers if analytics volume grows.
- Alternatives considered: A single monolith serving both UI and API would reduce moving parts initially but would weaken separation and future scaling flexibility.
