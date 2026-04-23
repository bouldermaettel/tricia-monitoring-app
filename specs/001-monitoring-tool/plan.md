# Implementation Plan: Monitoring Tool

**Branch**: `001-monitoring-tool` | **Date**: 2026-04-23 | **Spec**: [specs/001-monitoring-tool/spec.md](specs/001-monitoring-tool/spec.md)
**Input**: Feature specification from `/specs/001-monitoring-tool/spec.md`

## Summary

Build a monitoring web application with a FastAPI backend and a separate Vite + React frontend to support three workflows: low-friction case validation, confusion-matrix analysis, and operational oversight. The design centers on SQL-backed filtering and aggregation for interactive matrix views, Pandas-powered import/export, and centrally managed threshold configuration shared across dashboards.

## Technical Context

**Language/Version**: Python 3.11+ for backend, TypeScript 5.x for frontend  
**Primary Dependencies**: FastAPI, SQLAlchemy, Alembic, Pydantic, Pandas, OpenPyXL, PostgreSQL driver, React, Vite, React Router, TanStack Query, Zustand  
**Storage**: PostgreSQL as target production store; SQLite as default local development store  
**Testing**: pytest, httpx/TestClient, Vitest, React Testing Library  
**Target Platform**: Linux-hosted web application with browser frontend  
**Project Type**: Web application with separate frontend and backend services  
**Performance Goals**: Common dashboard filters and confusion-matrix queries should feel interactive under normal internal usage; CSV export should handle typical operational datasets without background jobs initially  
**Constraints**: Maintain SQLite/PostgreSQL compatibility at the ORM layer, keep routers thin, support CSV and Excel import/export, and centralize thresholds for all analytics decisions  
**Scale/Scope**: Initial internal tool with three dashboards, a normalized transactional data model, and a migration path toward larger datasets and horizontally scaled API workers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file is still a template and does not define enforceable principles, constraints, or governance rules. No binding gates are available to fail at planning time.

Pre-Phase-0 assessment:
- Pass: No explicit constitutional violations can be evaluated because the constitution is not ratified.
- Risk noted: Future constitution content may introduce test, security, or deployment gates that this plan should be checked against before implementation begins.

Post-Phase-1 assessment:
- Pass: The produced design remains modular, testable, and deployment-aware, so it is unlikely to conflict with a conventional engineering constitution once one is finalized.

## System Architecture Diagram

```text
+-----------------------------+        +--------------------------------+
| React Frontend (Vite)       |        | External Files                 |
|                             |        | CSV / Excel uploads, exports   |
| Pages                       |        +----------------+---------------+
| - Input Dashboard           |                         |
| - Matrix Dashboard          |                         v
| - Control Dashboard         |        +--------------------------------+
|                             |        | FastAPI Backend                |
| Client State                |<------>| API Routers                    |
| - selected matrix cell      |  REST  | - cases                        |
| - date range                |        | - matrices                     |
| - filter toggles            |        | - control                      |
|                             |        | - imports/exports              |
+--------------+--------------+        | - config                       |
               |                       +----------------+---------------+
               |                                        |
               v                                        v
      +--------------------+                 +--------------------------+
      | Query/Cache Layer  |                 | Service Layer            |
      | TanStack Query     |                 | - case service           |
      | Zustand UI state   |                 | - matrix service         |
      +--------------------+                 | - filter service         |
                                             | - import/export service  |
                                             | - threshold service      |
                                             +------------+-------------+
                                                          |
                                                          v
                                             +--------------------------+
                                             | Persistence Layer        |
                                             | SQLAlchemy models        |
                                             | SQLite local / Postgres  |
                                             +------------+-------------+
                                                          |
                                                          v
                                             +--------------------------+
                                             | Analytics Processing     |
                                             | SQL aggregation + Pandas |
                                             +--------------------------+
```

## Project Structure

### Documentation (this feature)

```text
specs/001-monitoring-tool/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rest-api.yaml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── cases.py
│   │   │   ├── matrices.py
│   │   │   ├── control.py
│   │   │   ├── imports.py
│   │   │   ├── exports.py
│   │   │   └── config.py
│   │   ├── dependencies.py
│   │   └── schemas/
│   ├── core/
│   │   ├── config.py
│   │   └── logging.py
│   ├── db/
│   │   ├── base.py
│   │   ├── session.py
│   │   └── migrations/
│   ├── models/
│   │   ├── case.py
│   │   ├── classification_snapshot.py
│   │   ├── case_review.py
│   │   ├── case_comment.py
│   │   ├── threshold_config.py
│   │   ├── import_job.py
│   │   └── user.py
│   ├── services/
│   │   ├── case_service.py
│   │   ├── validation_service.py
│   │   ├── matrix_service.py
│   │   ├── filter_service.py
│   │   ├── import_service.py
│   │   ├── export_service.py
│   │   └── threshold_service.py
│   └── main.py
└── tests/
    ├── unit/
    ├── integration/
    └── contract/

frontend/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── pages/
│   │   ├── InputDashboard.tsx
│   │   ├── MatrixDashboard.tsx
│   │   └── ControlDashboard.tsx
│   ├── components/
│   │   ├── input/
│   │   ├── matrix/
│   │   ├── control/
│   │   └── common/
│   ├── state/
│   │   ├── filters.ts
│   │   └── thresholds.ts
│   ├── hooks/
│   │   ├── useCases.ts
│   │   ├── useMatrix.ts
│   │   └── useControlQueue.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── cases.ts
│   │   ├── matrices.ts
│   │   ├── control.ts
│   │   ├── imports.ts
│   │   ├── exports.ts
│   │   └── config.ts
│   ├── types/
│   └── main.tsx
└── tests/
    ├── components/
    ├── hooks/
    └── pages/
```

**Structure Decision**: Use a web-application split with independent backend and frontend applications. The backend owns persistence, validation, analytics, and import/export logic; the frontend owns dashboard composition, server-state orchestration, and local interaction state.

## Backend Structure

### Routes
- `cases`: validation, create, list, detail, review updates, comments
- `matrices`: confusion matrix aggregation and matrix-specific drill-down filters
- `control`: workflow oversight queue and delay reporting
- `imports`: CSV/Excel upload and import job status
- `exports`: CSV/Excel exports for filtered analytical views
- `config`: threshold retrieval and update

### Services
- `validation_service`: duplicate detection, derived metadata, pre-save rules
- `case_service`: CRUD orchestration and case read models
- `filter_service`: reusable SQL filter composition for dates, problem flags, exclusion toggles, and selected matrix cells
- `matrix_service`: grouped aggregation, threshold evaluation, and matrix response shaping
- `import_service`: file parsing, row validation, deduplication strategy, job accounting
- `export_service`: Pandas dataframe generation and CSV/XLSX streaming
- `threshold_service`: centralized configuration lookup and update policy

### Models
- `Case`
- `ClassificationSnapshot`
- `CaseReview`
- `CaseComment`
- `CaseCategory`
- `ThresholdConfig`
- `ImportJob`
- `ImportJobError`
- `User`

## Frontend Structure

### Pages
- `InputDashboard`: form-first workflow for validate and save
- `MatrixDashboard`: confusion matrix, filter panel, case table, export actions
- `ControlDashboard`: oversight list, lateness filters, export actions

### Components
- `input/CaseForm`, `input/ValidationPreview`, `input/DuplicateDialog`
- `matrix/ConfusionMatrixGrid`, `matrix/MatrixLegend`, `matrix/CaseTable`, `matrix/FilterPanel`
- `control/ControlQueueTable`, `control/DelaySummary`
- `common/DateRangeSelector`, `common/ExportButton`, `common/AppShell`

### State
- TanStack Query for API-backed state and cache invalidation
- Lightweight store for selected matrix cell, date range, include-excluded toggle, problem-only toggle, and current threshold snapshot
- Form-local state for validation and duplicate-resolution flows

## Key API Endpoints

- `POST /api/v1/cases/validate`: pre-save validation, duplicate check, derived metadata, autofill preview
- `POST /api/v1/cases`: persist a validated case
- `GET /api/v1/cases`: filtered and paginated case listing
- `PATCH /api/v1/cases/{case_id}/review`: update category, exclusion, review status, and risk tagging
- `POST /api/v1/cases/{case_id}/comments`: add case annotation
- `GET /api/v1/matrices/confusion`: aggregated confusion matrix for active filters
- `GET /api/v1/control/queue`: oversight queue for missing or delayed work
- `POST /api/v1/imports`: upload CSV or Excel for validated ingest
- `GET /api/v1/exports/cases.csv`: export filtered case view as CSV
- `GET /api/v1/exports/cases.xlsx`: export filtered case view as Excel
- `GET /api/v1/config/thresholds`: read current thresholds
- `PUT /api/v1/config/thresholds`: update central threshold configuration

## Validation Workflow

1. Operator enters raw case data in the input dashboard.
2. Frontend performs basic client-side checks for required fields and numeric shape.
3. Frontend calls `POST /api/v1/cases/validate`.
4. Backend checks for duplicate `vk_number`, derives `analysis_date`, infers `user_id`, and returns suggested auto-fill values.
5. If duplicate exists, frontend shows an edit-or-cancel modal instead of saving.
6. Operator confirms or adjusts the values.
7. Frontend calls `POST /api/v1/cases` to persist the validated record and related classification snapshot.
8. Follow-up review actions update review state independently from raw classification inputs.

## Deployment Approach

### Target: Azure Container Apps
The application is designed for deployment on Azure Container Apps (ACA), which runs containerized workloads without managing underlying infrastructure. Each service (API, frontend) maps to a separate ACA revision.

### Local development
- Run FastAPI and Vite as separate dev servers.
- Use SQLite as the default local database.
- Use Alembic from the start so the SQLite schema stays aligned with PostgreSQL migration history.
- Docker is not required for day-to-day development, but Dockerfiles should exist from the start so local container behaviour can be verified before pushing.

### Local container testing
A `docker-compose.yml` at the repo root provides a production-like stack for integration testing:
- `backend` service built from `backend/Dockerfile`
- `frontend` service built from `frontend/Dockerfile`
- `postgres` service from `postgres:15` for compatibility verification

### Azure Container Apps deployment
- Backend and frontend are published as separate ACA container apps.
- Database is Azure Database for PostgreSQL (Flexible Server).
- Images are stored in Azure Container Registry and deployed via CI/CD (GitHub Actions).
- Alembic migrations run as a startup command or dedicated init container before the API starts.
- All configuration is injected as ACA environment variables or secrets; nothing is baked into images.
- The frontend build artifact is served as static files from within its container (Nginx-based image) or via Azure Static Web Apps as a simpler alternative.

### Environment variable conventions (local and ACA identical)
- `DATABASE_URL`: SQLite file path locally, PostgreSQL connection string in ACA.
- `APP_ENV`: `local`, `staging`, or `production`.
- `CORS_ORIGINS`: comma-separated list of allowed frontend origins.
- `SECRET_KEY`: used for any session/token signing.

### Scaling path on ACA
- ACA scales API replicas automatically on HTTP traffic; set minimum replicas to 1 to avoid cold starts.
- Add Redis caching (Azure Cache for Redis) for repeated matrix queries if usage volume increases.
- Move heavy imports or exports to background jobs (ACA jobs or Celery on a separate container) when dataset size justifies it.
- Use Azure Blob Storage for generated export files if retention becomes a requirement.

## Complexity Tracking

No constitution-based violations were identified, so no exceptions require justification.
