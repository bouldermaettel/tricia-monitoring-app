# Development Environment Clone Strategy

This document records how the productive Tricia Monitoring environment was cloned into an isolated development environment and how the data was copied safely.

## Source environment

The live productive deployment is in the `smc-sandbox-smc-four-point-zero` subscription and resource group `tricia-monitoring-rg`:

- Frontend: `tricia-monitoring-frontend`
- Backend: `tricia-monitoring-backend`
- Container Apps environment: `tricia-monitoring-env`
- PostgreSQL: `tricia-monitoring-pg`
- Container image tag: `20260722161758`
- Region: Switzerland North

The productive split frontend/backend deployment is the source of truth. The older repository Bicep template describes a different, simpler deployment and must not be used to infer the live production configuration.

## Development deployment

The isolated development resources are in `tricia-monitoring-dev-rg`:

- Frontend: `tricia-monitoring-dev-frontend`
- Backend: `tricia-monitoring-dev-backend`
- Container Apps environment: `tricia-monitoring-dev-env`
- PostgreSQL: `tricia-monitoring-dev-pg`
- Log Analytics: `tricia-monitoring-dev-logs`

The dev apps use the same pinned frontend and backend image tag as production. Runtime behavior, CPU, memory, scaling, ingress, and database version were replicated. Dev has separate hostnames, database credentials, JWT secret, bootstrap credentials, and CORS configuration.

The existing ACR is reused only to pull the pinned images. The dev apps do not share the productive database or application secrets.

## Database network strategy

The dev PostgreSQL server uses public access with the standard Azure-services firewall rule required for Azure Container Apps connectivity. In addition, the known dev Container Apps outbound addresses are explicitly configured as firewall rules.

Temporary operator firewall rules were used only during migration and were removed afterward. The public PostgreSQL tunnel containers from production were not cloned and are not part of the dev runtime.

## Exact data-copy strategy

The productive database is treated as read-only. The repeatable
`scripts/clone_prod_to_dev.py` command copies the complete application dataset,
including `users`, into dev after both databases have the same Alembic revision.
The preferred execution path is the dedicated Azure Container Instance
launcher `scripts/launch_prod_to_dev_clone.sh`, because local PostgreSQL access
may be blocked. The clone is dry-run by default and requires `--apply` before it
can replace dev data.

The copy preserves:

- cases, classifications, reviews, thresholds, categories, import jobs, audit
  events, comments, filenames, record timestamps, statuses, and relationships;
- original VK numbers, WIMI shortcuts, device names, comments, and categories;
- the complete `users` table, including IDs, acronyms, names, roles, active
  status, and password hashes.

Before modifying dev, the command creates a custom-format `pg_dump` backup in
the dedicated migration container. The launcher retains the stopped container
by default so the backup remains available for recovery. Deleting the
container deletes the backup.
The copy uses transactional `TRUNCATE ... RESTART IDENTITY CASCADE`, derives a
foreign-key-safe insertion order, resets sequences, and validates table counts
and row contents. PostgreSQL administrative trigger settings are not changed.
If the source is on an older additive schema, shared columns are copied and
known derived columns (`user_p`, `tri_risk`, and `wimi_risk`) are backfilled.
Unknown schema differences still abort before dev is modified.

## Migration workflow

1. Provision the new resource group, Log Analytics workspace, Container Apps environment, and PostgreSQL server.
2. Create the dev database and deploy the pinned backend image.
3. Allow backend migrations to create the dev schema.
4. Build and run the dedicated Azure migration container with
   `scripts/launch_prod_to_dev_clone.sh`.
5. Keep the stopped migration container until parity and application checks pass.
6. Deploy/restart the dev backend with a separate dev-only bootstrap account so
   startup configuration does not overwrite copied production users.
7. Verify the dev frontend and API.

Example:

```bash
bash scripts/launch_prod_to_dev_clone.sh
```

## Verification checklist

- Both dev Container App revisions are `Healthy` and `Running`.
- Each dev app has 100% traffic on its latest revision.
- Frontend returns HTTP `200`.
- Backend `/docs` returns HTTP `200`.
- Frontend-to-backend CORS preflight returns HTTP `200` with the dev origin.
- User login works with the copied production user records and password hashes.
- Authenticated case access returns HTTP `200`.
- A recoverable backup of the previous dev database exists inside the retained
  migration container.
- Every copied table, including `users`, has matching counts and row contents.
- Dev API case totals and visible totals match prod with identical filters.
- Production backend remains healthy with 100% traffic.
- Production database and application resources are not changed by the clone process.

## Operational cautions

- Never copy productive secret values into source control or normal dev configuration.
- Never point the dev backend at the productive database.
- Do not recreate the public production PostgreSQL tunnels for normal development.
- Pin image tags when reproducing a known-good deployment.
- The productive database credential should be rotated after the migration-terminal credential exposure encountered during setup. The rotation requires an explicit production-change approval because it updates the live backend secret and restarts the productive backend.

## Infrastructure as code

The live prod/dev Container Apps configuration is managed by `infra/live/main.bicep` and selected with `deploy-live.sh`:

```bash
WHAT_IF=1 ENV_FILE=.env.tricia-dev ./deploy-live.sh dev 20260722161758
ENV_FILE=.env.tricia-dev ./deploy-live.sh dev 20260722161758
ENV_FILE=.env.tricia-prod ./deploy-live.sh prod 20260722161758
```

The environment files are intentionally not committed. They must define `DATABASE_URL`, `SECRET_KEY`, `BOOTSTRAP_ADMIN_USERNAME`, and `BOOTSTRAP_ADMIN_PASSWORD`; frontend/backend origins are discovered from the selected existing apps unless explicitly provided. The template references the existing ACR, Container Apps environment, and PostgreSQL server for the selected target, so it manages application configuration without recreating or copying database data.
