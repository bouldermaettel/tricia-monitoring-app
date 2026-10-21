# Tricia Monitoring App – application overview

## Purpose

The Tricia Monitoring App is a case-review and monitoring workflow for safety and quality assessment data. It supports a data-entry flow, structured review, matrix analysis, governance controls, and user administration. In practical terms, it is used to ingest monitoring cases, validate them against expected and observed values, assess risk and category, review exclusions and overrides, and export reports for downstream analysis.

The application is split into a FastAPI backend and a React + TypeScript frontend. The backend stores case records and review state in PostgreSQL, while the frontend is the browser-based operational interface used by reviewers and administrators.

It is intended as an operational control surface for regulated monitoring work: the app not only captures records, but also enforces review structure, auditability, and repeatable QA checks across the most important end-user actions.

## Core business workflow

1. A case is created or imported from an external file.
2. The user validates the case identifier and measurement data.
3. The system calculates or infers risk-related values, including severity, probability, detectability, and category classification.
4. Reviewers can assess whether a case is included, excluded, reviewed, or flagged for follow-up.
5. The matrix dashboard groups cases by dimension and risk pattern.
6. Admins manage users and governance controls.
7. Reports and exported spreadsheets can be generated from filtered or selected case sets.

## Functional areas

### 1. Input / case creation

The application’s input workflow is centered on the `/input` page.

Key responsibilities:
- Create new cases from a VK number and device metadata
- Validate identifier format and date structures
- Capture tricia and user values for severity, probability, and detectability
- Auto-fill or infer related values where possible
- Block duplicate case records and surface duplicate warnings
- Allow import of spreadsheet records with duplicate conflict handling

This path is meant to keep data entry consistent and to prevent invalid or duplicate records entering the system.

### 2. Matrix review

The `/matrix` page is the main analytical workspace. It combines filter controls, a confusion-matrix style display, and a case table. It lets reviewers:
- Filter by date, risk, category, device, or specific matrix cells
- View grouped rows by product, severity, detectability, probability, and risk dimensions
- Sort and paginate the loaded case set
- Review individual cases in the context of the matrix
- Export filtered or selected record sets as reports

The matrix surface is a critical operations area for review teams, because it allows them to inspect risk distribution and targeted subsets rather than working only with raw single-record data.

### 3. Control / admin governance

The `/control` page is restricted to administrators.

Typical responsibilities:
- Review operational controls and queue-driven tasks
- Manage import or review workflows that require privileged access
- Observe higher-level control state and cross-cutting admin actions
- Remove or manage bulk records when required

This area keeps sensitive actions separated from normal reviewer workflows.

### 4. User management

The `/users` page is also restricted to admin users.

Responsibilities:
- Create and manage user accounts
- Maintain roles and account state
- Force password changes where needed
- Control access for the application’s user model

### 5. Authentication and access control

The login flow uses a JWT-based authentication model:
- Login at `/login`
- Password-change workflow for forced credential resets
- Session issuance via `/api/v1/auth/session`
- Token refresh via `/api/v1/auth/refresh`
- Access control on protected routes and API endpoints

The application distinguishes between regular users and admin users, and routes enforce role-based access. A user who must reset their password is redirected to `/change-password` before they can proceed.

## Frontend structure

The frontend is a React application with Vite as the bundler and TypeScript as the primary language. The main routes are:

- `/login` — sign in
- `/change-password` — required password reset flow
- `/input` — new case creation and import workflows
- `/matrix` — main review and reporting dashboard
- `/control` — admin workflow and controls
- `/users` — user administration

The app relies on:
- React Router for navigation
- React Query for remote data fetching and caching where appropriate
- Auth state stored and managed centrally
- Local UI state for filters, export, and review interactions

## Backend structure

The backend is a FastAPI service that exposes a set of REST endpoints for authentication, case management, and review actions.

Main backend responsibilities:
- Login and token creation
- CRUD and review operations for cases
- Validation of case inputs and duplicate detection
- Listing, filtering, sorting, and pagination of case records
- Category and risk calculations
- Audit trail retrieval
- Import and export-oriented workflows

Notable API groups include:
- `/api/v1/auth` — user authentication and token negotiation
- `/api/v1/cases` — case creation, listing, validation, update, and review
- `/api/v1/users` — user management
- Import and export related routes and services for file-driven work

## Data model

The records at the center of the application represent monitored cases. Each case contains values such as:
- identifier (`vk_number`)
- device name
- analysis date
- tricia severity / probability / detectability
- user severity / probability / detectability
- derived risk values
- category code
- review flags like `is_excluded`, `is_reviewed`, and `has_edits`
- comment count and comment text

The application supports derived values and risk dimensions, which are important for confusion-matrix review and QA decisions.

## Risk and review logic

The domain logic is not just a data capture tool; it encodes review semantics.

The app supports:
- risk level classification
- category code updates
- review state transitions
- exclusions and overrides
- audit history for changes

This means the system is intended as a controlled review and governance environment rather than a simple spreadsheet utility.

## Import and export flow

The application includes import flows for structured data, including spreadsheet-based entry. The import component validates incoming content and handles duplicate conflicts in a user-friendly way. Export paths are available for reports and tabular extraction from filtered result sets.

The report export path is especially important because it must use the full filtered result set rather than only the currently visible page. This is a key quality issue in the review workflow, because a reviewer can otherwise export an incomplete report from a multi-page result set.

## Deployment model

The project uses Azure Container Apps for deployed environments. The live environment model is defined under `infra/live/main.bicep` and is orchestrated by `deploy-live.sh`.

The project also includes a browser-based quality gate for the deployed application: a Playwright suite validates the critical path, matrix filter scenarios, report exports, and admin/data-entry flows so the live environment remains aligned with the product’s intended operational behavior.

The deployment includes:
- backend and frontend Container Apps
- Azure Container Registry for built images
- PostgreSQL Flexible Server or a reused environment-specific database
- secret injection for application configuration
- Azure Log Analytics integration for logs

The application is intended to be deployed separately for development and production environments, while sharing a similar configuration pattern.

## Operational characteristics

The app is primarily an operational review tool for regulated or monitored product data. It is designed for repeatable and auditable decision-making. The app distinguishes between data entry, analysis, and admin control to ensure that changes are traceable and that only authorized roles can modify critical state.

## Summary

The Tricia Monitoring App is a risk-review and case-management application for monitored product data. It combines a secure backend, a structured UI, matrix-based review logic, admin controls, and audit-oriented workflows. Its most critical value is that it turns raw monitoring records into a reviewable, filtered, and defensible decision process.
