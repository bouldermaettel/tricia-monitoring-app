# Tasks: Monitoring Tool

**Input**: Design documents from `/specs/001-monitoring-tool/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.yaml, quickstart.md

**Tests**: Include backend unit/integration/contract tests and frontend component/page tests for each user story, plus containerized PostgreSQL and Azure Container Apps deployment validation.

**Organization**: Tasks are grouped by phase and user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize backend/frontend projects, tooling, and container/deployment baseline.

- [x] T001 Initialize backend package and dependency manifest in backend/pyproject.toml
- [x] T002 Initialize frontend Vite React TypeScript app shell in frontend/package.json and frontend/src/main.tsx
- [x] T003 [P] Add backend environment template and settings bootstrap in backend/.env.example and backend/src/core/config.py
- [x] T004 [P] Add frontend environment template and API base URL config in frontend/.env.example and frontend/src/services/api.ts
- [x] T005 Create backend app entrypoint and router registration scaffold in backend/src/main.py and backend/src/api/__init__.py
- [x] T006 [P] Create backend and frontend container images in backend/Dockerfile and frontend/Dockerfile
- [x] T007 [P] Create local integration stack for API/frontend/PostgreSQL in docker-compose.yml
- [x] T008 Configure baseline CI checks for backend and frontend in .github/workflows/ci.yml
- [x] T009 [P] Create Python and frontend test runner configuration in backend/pytest.ini and frontend/vitest.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared persistence, schema, service, and observability layers required by all stories.

**⚠️ CRITICAL**: Complete this phase before starting user story implementation.

- [x] T010 Create SQLAlchemy base/session and engine switching for SQLite/PostgreSQL in backend/src/db/base.py and backend/src/db/session.py
- [x] T011 Create initial domain models for shared entities in backend/src/models/case.py, backend/src/models/classification_snapshot.py, backend/src/models/user.py, backend/src/models/threshold_config.py, backend/src/models/import_job.py
- [x] T012 Create Alembic configuration and initial migration for core tables in backend/alembic.ini and backend/src/db/migrations/versions/001_initial_schema.py
- [x] T013 [P] Seed static case category reference data in backend/src/db/seeds/case_categories.py
- [x] T014 Implement shared Pydantic schemas for cases, matrix, control, import/export, and config in backend/src/api/schemas/cases.py, backend/src/api/schemas/matrices.py, backend/src/api/schemas/control.py, backend/src/api/schemas/imports.py, backend/src/api/schemas/config.py
- [x] T015 [P] Implement reusable query/filter composition utilities in backend/src/services/filter_service.py
- [x] T016 [P] Implement structured logging and request correlation middleware in backend/src/core/logging.py and backend/src/api/middleware/request_context.py
- [x] T017 [P] Implement shared dependency providers (db session, actor resolution) in backend/src/api/dependencies.py
- [x] T018 Add contract test harness loader for OpenAPI assertions in backend/tests/contract/test_openapi_contract.py

**Checkpoint**: Foundation complete; user stories can now be delivered independently.

---

## Phase 3: User Story 1 - WiMi Input Validation and Save (Priority: P1) 🎯 MVP

**Goal**: Enable fast WiMi case entry with validate-then-save flow, duplicate handling, metadata derivation, and auto-fill behavior.

**Independent Test**: A WiMi can validate and save a new case, receives duplicate conflict guidance for an existing `vk_number`, and unchanged values auto-copy from Tricia fields.

### Tests for User Story 1

- [x] T019 [P] [US1] Add contract tests for POST /cases/validate and POST /cases in backend/tests/contract/test_cases_input_contract.py
- [x] T020 [P] [US1] Add backend service tests for duplicate detection and vk-derived analysis date in backend/tests/unit/test_validation_service.py
- [x] T021 [P] [US1] Add API integration tests for validate/save workflow in backend/tests/integration/test_cases_input_flow.py
- [x] T022 [P] [US1] Add frontend page tests for validate/save and duplicate dialog in frontend/tests/pages/InputDashboard.test.tsx

### Implementation for User Story 1

- [x] T023 [US1] Implement validation orchestration (autofill, duplicate checks, user inference) in backend/src/services/validation_service.py
- [x] T024 [US1] Implement case persistence workflow with validation state transitions in backend/src/services/case_service.py
- [x] T025 [US1] Implement cases API routes for validate/create/list base behavior in backend/src/api/routers/cases.py
- [x] T026 [US1] Implement input dashboard form with rapid-entry UX and validate/save actions in frontend/src/pages/InputDashboard.tsx
- [x] T027 [US1] Implement duplicate resolution dialog component in frontend/src/components/input/DuplicateDialog.tsx
- [x] T028 [P] [US1] Implement case API client hooks for validate/save calls in frontend/src/services/cases.ts and frontend/src/hooks/useCases.ts
- [x] T029 [US1] Wire input dashboard route/navigation in frontend/src/app/router.tsx

**Checkpoint**: US1 is shippable as MVP.

---

## Phase 4: User Story 2 - Matrix Analysis and Case Review (Priority: P1)

**Goal**: Deliver interactive confusion matrix analysis with period filters, drill-down table, risk/problem toggles, and per-case review actions.

**Independent Test**: Analyst can switch date windows (3M/6M/12M/ALL/CUSTOM), inspect matrix colors against thresholds, click a cell to filter cases, and update review metadata.

### Tests for User Story 2

- [x] T030 [P] [US2] Add contract tests for GET /matrices/confusion and PATCH /cases/{case_id}/review in backend/tests/contract/test_matrix_review_contract.py
- [x] T031 [P] [US2] Add unit tests for matrix aggregation and threshold evaluation in backend/tests/unit/test_matrix_service.py
- [x] T032 [P] [US2] Add integration tests for matrix filters, problematic-only toggle, and exclude/include behavior in backend/tests/integration/test_matrix_filters.py
- [x] T033 [P] [US2] Add frontend dashboard interaction tests for matrix cell drill-down and table filters in frontend/tests/pages/MatrixDashboard.test.tsx

### Implementation for User Story 2

- [x] T034 [US2] Implement confusion matrix aggregation and threshold comparison logic in backend/src/services/matrix_service.py
- [x] T035 [US2] Extend case review update logic (category, reviewed, excluded, risk level) in backend/src/services/case_service.py
- [x] T036 [US2] Implement matrix API router and case review patch endpoint wiring in backend/src/api/routers/matrices.py and backend/src/api/routers/cases.py
- [x] T037 [US2] Implement matrix dashboard page and filter orchestration in frontend/src/pages/MatrixDashboard.tsx and frontend/src/state/filters.ts
- [x] T038 [P] [US2] Implement matrix UI components (grid, legend, case table, filter panel) in frontend/src/components/matrix/ConfusionMatrixGrid.tsx, frontend/src/components/matrix/MatrixLegend.tsx, frontend/src/components/matrix/CaseTable.tsx, frontend/src/components/matrix/FilterPanel.tsx
- [x] T039 [P] [US2] Implement matrix data hooks and service clients in frontend/src/hooks/useMatrix.ts and frontend/src/services/matrices.ts
- [x] T040 [US2] Add row risk-direction highlighting and review action controls in frontend/src/components/matrix/CaseTable.tsx

**Checkpoint**: US2 analytics and review workflow operate independently.

---

## Phase 5: User Story 3 - Control Dashboard Oversight (Priority: P2)

**Goal**: Provide controller-facing oversight for missing/delayed entries across selected date periods.

**Independent Test**: Controller can filter control queue by date/status and identify delayed or missing completion records.

### Tests for User Story 3

- [x] T041 [P] [US3] Add contract tests for GET /control/queue in backend/tests/contract/test_control_contract.py
- [x] T042 [P] [US3] Add unit tests for control delay bucket computation in backend/tests/unit/test_control_service.py
- [x] T043 [P] [US3] Add integration tests for control queue filtering and status outputs in backend/tests/integration/test_control_queue.py
- [x] T044 [P] [US3] Add frontend page tests for control filters and delayed-entry rendering in frontend/tests/pages/ControlDashboard.test.tsx

### Implementation for User Story 3

- [x] T045 [US3] Implement control queue service/read model and delay logic in backend/src/services/control_service.py
- [x] T046 [US3] Implement control queue API endpoint in backend/src/api/routers/control.py
- [x] T047 [US3] Implement control dashboard page and date/status filters in frontend/src/pages/ControlDashboard.tsx
- [x] T048 [P] [US3] Implement control table/summary components in frontend/src/components/control/ControlQueueTable.tsx and frontend/src/components/control/DelaySummary.tsx
- [x] T049 [P] [US3] Implement control API hook/client in frontend/src/hooks/useControlQueue.ts and frontend/src/services/control.ts

**Checkpoint**: US3 oversight workflow is independently testable.

---

## Phase 6: User Story 4 - Imports, Exports, and Central Threshold Configuration (Priority: P2)

**Goal**: Support CSV/XLSX import, filtered export from analysis/control views, and centralized threshold management.

**Independent Test**: Admin/operator can import CSV/XLSX with row-level validation reporting, update thresholds centrally, and export filtered data as CSV/XLSX from matrix/control dashboards.

### Tests for User Story 4

- [x] T050 [P] [US4] Add contract tests for POST /imports, GET /exports/cases.csv, GET /exports/cases.xlsx, and PUT /config/thresholds in backend/tests/contract/test_import_export_config_contract.py
- [x] T051 [P] [US4] Add unit tests for import row validation and job accounting in backend/tests/unit/test_import_service.py
- [x] T052 [P] [US4] Add unit tests for export dataframe shaping and file serialization in backend/tests/unit/test_export_service.py
- [x] T053 [P] [US4] Add integration tests for threshold update propagation into matrix responses in backend/tests/integration/test_threshold_runtime_updates.py
- [x] T054 [P] [US4] Add frontend tests for import flow, export actions, and threshold config interactions in frontend/tests/pages/DataOpsAndConfig.test.tsx

### Implementation for User Story 4

- [x] T055 [US4] Implement import processing service with CSV/XLSX validation and import job tracking in backend/src/services/import_service.py
- [x] T056 [US4] Implement export service for filtered CSV/XLSX generation in backend/src/services/export_service.py
- [x] T057 [US4] Implement threshold configuration service with central active-record policy in backend/src/services/threshold_service.py
- [x] T058 [US4] Implement import/export/config routers in backend/src/api/routers/imports.py, backend/src/api/routers/exports.py, backend/src/api/routers/config.py
- [x] T059 [US4] Implement frontend import/export clients and hooks in frontend/src/services/imports.ts, frontend/src/services/exports.ts, frontend/src/services/config.ts, frontend/src/hooks/useThresholds.ts
- [x] T060 [US4] Add import uploader and export controls to matrix/control pages in frontend/src/components/common/ExportButton.tsx, frontend/src/pages/MatrixDashboard.tsx, frontend/src/pages/ControlDashboard.tsx
- [x] T061 [US4] Implement threshold configuration panel/state in frontend/src/components/common/ThresholdConfigPanel.tsx and frontend/src/state/thresholds.ts

**Checkpoint**: US4 data operations and centralized configuration function independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, deployment validation, and documentation aligned to Azure Container Apps target.

- [x] T062 [P] Add backend performance indexes for matrix/control queries in backend/src/db/migrations/versions/002_dashboard_indexes.py
- [x] T063 [P] Add API error envelope standardization and global exception handlers in backend/src/api/errors.py and backend/src/main.py
- [x] T064 [P] Add frontend loading/error empty-state UX polish in frontend/src/components/common/AppShell.tsx and frontend/src/pages/MatrixDashboard.tsx
- [x] T065 Add Azure Container Apps deployment manifests for backend/frontend in infra/aca/backend-app.yaml and infra/aca/frontend-app.yaml
- [x] T066 Add ACA deployment workflow using ACR images and migration step in .github/workflows/deploy-aca.yml
- [x] T067 Run end-to-end quickstart validation and capture expected commands in specs/001-monitoring-tool/quickstart.md
- [x] T068 [P] Update architecture and runbook docs for operations and troubleshooting in README.md and docs/architecture/monitoring-tool.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks all user stories.
- User Stories (Phases 3-6) depend on Foundational completion.
- Polish (Phase 7) depends on completion of selected user stories.

### User Story Dependencies

- US1 (P1): Starts after Phase 2; no dependency on other stories.
- US2 (P1): Starts after Phase 2; depends on shared case/matrix foundations but not on US1 UI completion.
- US3 (P2): Starts after Phase 2; independent from US1/US2 delivery.
- US4 (P2): Starts after Phase 2; can run parallel with US3 and integrates with US2 filters for exports.

### Suggested Delivery Order

- MVP scope: Phase 1 → Phase 2 → Phase 3 (US1).
- Analytics increment: Add Phase 4 (US2).
- Oversight increment: Add Phase 5 (US3).
- Data operations increment: Add Phase 6 (US4).
- Hardening/deploy: Complete Phase 7.

---

## Parallel Opportunities

- Setup: T003, T004, T006, T007, T009 can run together after T001-T002.
- Foundation: T013, T015, T016, T017, T018 can run in parallel once T010-T012 are in place.
- US1: T019-T022 can run in parallel; T028 can run in parallel with T026-T027 after API contracts stabilize.
- US2: T030-T033 parallel test creation; T038 and T039 parallel frontend implementation.
- US3: T041-T044 parallel tests; T048 and T049 parallel frontend tasks.
- US4: T050-T054 parallel tests; T059-T061 parallel frontend/config tasks.
- Polish: T062, T063, T064, T068 can run in parallel.

## Parallel Example: User Story 2

```bash
Task: "T031 [US2] backend matrix aggregation unit tests in backend/tests/unit/test_matrix_service.py"
Task: "T032 [US2] backend integration tests in backend/tests/integration/test_matrix_filters.py"
Task: "T033 [US2] frontend matrix interaction tests in frontend/tests/pages/MatrixDashboard.test.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "T051 [US4] import service tests in backend/tests/unit/test_import_service.py"
Task: "T052 [US4] export service tests in backend/tests/unit/test_export_service.py"
Task: "T054 [US4] frontend data operations tests in frontend/tests/pages/DataOpsAndConfig.test.tsx"
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Setup and Foundational phases.
2. Deliver US1 end-to-end with tests passing.
3. Validate rapid WiMi workflow and duplicate handling.
4. Demo/deploy MVP slice.

### Incremental Delivery

1. Add US2 for matrix analytics and review workflow.
2. Add US3 for control oversight.
3. Add US4 for import/export and threshold administration.
4. Finish with ACA deployment hardening in Polish.

### Validation Gates

- Contract tests must pass for endpoints defined in contracts/rest-api.yaml.
- SQLite local tests and PostgreSQL containerized integration tests must both pass before deployment.
- ACA deployment workflow must apply migrations and complete post-deploy smoke checks.
