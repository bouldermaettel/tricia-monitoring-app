# Dev functional test plan for the deployed app

This document describes a repeatable functional test plan for the deployed dev instance of the Tricia Monitoring App. It is designed to be run by a reviewer or operator who wants to verify that the live application is healthy, that authentication works, and that key business workflows are still functioning.

## Test targets

- Frontend: https://tricia-monitoring-dev-frontend.kindwave-0284be09.switzerlandnorth.azurecontainerapps.io
- Backend: https://tricia-monitoring-dev-backend.kindwave-0284be09.switzerlandnorth.azurecontainerapps.io

## Required inputs

You need:
- a valid dev username and password
- access to the dev environment over HTTPS
- a shell with `curl`, `python3`, and optionally `jq`

## Repeatable smoke test script

The repository includes a reusable script for this exact purpose:

```bash
./scripts/dev-functional-check.sh
```

The script accepts environment overrides:

```bash
DEV_FRONTEND_URL="https://..." \
DEV_BACKEND_URL="https://..." \
DEV_ADMIN_USERNAME="<username>" \
DEV_ADMIN_PASSWORD="<password>" \
./scripts/dev-functional-check.sh
```

It validates the following:
1. frontend root is reachable
2. backend docs page is reachable
3. login to `/api/v1/auth/session` succeeds
4. token-based access to the cases list succeeds
5. validation of a sample case succeeds
6. the backend returns structured JSON from the main case listing endpoint

## Manual verification checklist

### 1. Frontend load test

Open the frontend URL in a browser.

Expected result:
- the page loads without a blank screen
- the app renders the login or default route flow
- no obvious 5xx or infrastructure error page

### 2. Login test

Use a valid dev user.

Expected result:
- login succeeds
- the user is redirected to the default protected page (`/input` or equivalent default route)
- a valid session is created

### 3. Input page validation test

Navigate to `/input`.

Try the following:
- enter a valid `Vk_` identifier format
- fill in a device name
- set a valid severity/probability/detectability combination
- save the record

Expected result:
- the record is accepted
- duplicate checks do not block a genuinely new record
- validation logic returns the expected success behavior

### 4. Duplicate detection test

Attempt to create a second case with the same `vk_number` as an existing record.

Expected result:
- the app surfaces a duplicate warning or conflict response
- it does not silently create a duplicate record

### 5. Matrix dashboard test

Navigate to `/matrix`.

Expected result:
- filter controls are visible
- the table loads data
- sorting and pagination are available
- rows are filtered according to the selected risk or analysis criteria
- there is no obvious first-page-only export problem when filtering across multiple pages

### 6. Report export test

Apply a filter that returns more than one page of records, then trigger export.

Expected result:
- the exported report includes all filtered rows, not only the currently visible page
- the output reflects the full filtered dataset

### 7. Admin controls test

Login as an admin user and navigate to `/control` and `/users`.

Expected result:
- admin-only routes are accessible
- non-admin users are redirected away from them
- user and governance actions behave as expected

### 8. Password change / session handling test

Log in with a user that needs a password change if available.

Expected result:
- the user is redirected to `/change-password`
- the password change flow works
- a refresh can be used to renew the token after expiration

### 9. API smoke tests

Run the backend API checks directly via command line:

```bash
curl -sS -X POST "$DEV_BACKEND_URL/api/v1/auth/session" \
  -H "Content-Type: application/json" \
  -d '{"username":"<username>","password":"<password>"}'
```

Then use the returned `access_token` to call the case list:

```bash
curl -sS -H "Authorization: Bearer <token>" \
  "$DEV_BACKEND_URL/api/v1/cases?all=true&page=1&page_size=1"
```

Expected result:
- the login returns a token payload
- the case list returns a JSON document containing `items`, `page`, `page_size`, and `total`

## Pass/fail criteria

The dev deployment passes if all the following are true:
- frontend is reachable and loads
- backend is reachable and docs page loads
- authentication works
- protected case APIs return valid JSON
- case validation works
- matrix workflow loads and exports the full filtered dataset
- admin-only routes behave correctly

## Failure conditions to record

If a test fails, record:
- affected URL or route
- HTTP status code
- whether the failure is a frontend, backend, auth, or data issue
- reproduction steps
- expected vs actual behavior

## Clean repeat procedure

1. Ensure the dev environment is the intended target.
2. Confirm user credentials are valid.
3. Run the script:

```bash
./scripts/dev-functional-check.sh
```

4. If the script passes, run the browser-based checks listed above.
5. Capture any issue details and escalate to the appropriate team with the exact route, payload, and output snippet.

## Notes

This checklist is intentionally focused on deployed behavior. It is not a substitute for full automated integration tests in CI, but it is a practical test plan for verifying the live dev deployment after a change or before a release.
