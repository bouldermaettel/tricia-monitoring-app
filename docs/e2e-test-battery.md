# End-to-end regression battery for Tricia Monitoring

This document explains how to run and interpret the browser-based regression suite for the Tricia Monitoring app. It complements the operational overview by focusing on the application’s highest-risk end-user workflows: review navigation, matrix filtering, case creation, admin management, and export integrity.

## Scope

The suite verifies the main user journeys that must keep working in the deployed app:

- sign-in and route protection
- Matrix dashboard loading and filter interaction
- report export downloads
- Control dashboard access and date selection
- User management flows
- valid case creation from the Input dashboard
- seeded QA regression coverage across major matrix combinations and admin/data-entry flows

## Human-readable usage

### Prerequisites

- the app is running in the target environment
- the admin credentials are available through environment variables or the default local fallback values
- the browser can reach the frontend URL

### Run the suite

From the frontend project folder:

```bash
cd frontend
npm install
npx playwright test tests/e2e/critical-path.spec.ts --project=chromium --reporter=list
```

Run against a different environment:

```bash
cd frontend
PLAYWRIGHT_BASE_URL=https://your-app-url \
E2E_USERNAME=your-admin-user \
E2E_PASSWORD=your-admin-password \
npx playwright test tests/e2e/critical-path.spec.ts --project=chromium --reporter=list
```

### Read the output

- passing tests mean the critical user journeys still work on that deployment
- failing tests indicate a regression in the app’s browser behavior or a selector mismatch
- Playwright stores traces, screenshots, and videos in `frontend/test-results/`

## Machine-readable usage

The suite can be run from CI or another automation environment with the following contract:

```json
{
  "suite_name": "tricia-monitoring-critical-path",
  "runner": "playwright",
  "entrypoint": "frontend/tests/e2e/critical-path.spec.ts",
  "config": "frontend/playwright.config.ts",
  "environment": {
    "PLAYWRIGHT_BASE_URL": "required",
    "E2E_USERNAME": "required",
    "E2E_PASSWORD": "required"
  },
  "checks": [
    "admin login and route access",
    "matrix page renders",
    "matrix filter updates summary state",
    "matrix export generates a file",
    "control dashboard date selectors stay usable",
    "user-management create-user flow",
    "input dashboard creates a valid case"
  ]
}
```

A CI command would be:

```bash
PLAYWRIGHT_BASE_URL="$TARGET_URL" \
E2E_USERNAME="$ADMIN_USER" \
E2E_PASSWORD="$ADMIN_PASS" \
npx playwright test tests/e2e/critical-path.spec.ts --project=chromium --reporter=list
```

## Extending the battery

The suite is intentionally structured as a repeatable critical-path battery. It can be expanded later with:

- additional filter combinations for the Matrix dashboard
- richer export assertions for all file formats
- admin permission and role-specific checks
- seeded QA fixtures for deterministic verification
- CI gating for deployments to dev and prod

This makes the battery suitable for both manual QA and automated regression control.

## Report pagination regression tests

The deterministic report suite intercepts API requests with known data and verifies
complete HTML and PDF print-document rows, page/page-size independence, sorting,
and probability/severity selection intersections. It does not create application data.

To test local report changes, start the frontend with `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`, then run:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 \
  npx playwright test tests/e2e/report-pagination.spec.ts --workers=1
```

The PDF assertions inspect the document sent to the browser print workflow;
they do not automate the operating system's Save as PDF dialog.
