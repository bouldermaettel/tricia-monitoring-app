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

## Sanitized data-copy strategy

The productive database was treated as read-only. Data was copied into the empty dev schema after the dev backend ran its migrations.

The copy preserved realistic relationships and operational behavior while removing production identities and free text:

- Preserved cases, classifications, reviews, thresholds, categories, import jobs, and record timestamps/statuses.
- User records were not copied. Foreign-key user references were set to `NULL` where applicable.
- Created a separate development administrator through the dev bootstrap configuration.
- Replaced `vk_number` values with `DEV-VK-*` identifiers.
- Replaced device names with `DEV-DEVICE-*` identifiers.
- Replaced WIMI shortcuts with `DEV-WIMI-*` identifiers.
- Replaced import filenames with synthetic sanitized filenames.
- Replaced external user keys and display names with synthetic development identities.
- Replaced case comments and import-error messages with generic sanitized text.
- Replaced audit-event JSON changes with `{ "sanitized": true }`.
- Did not copy password hashes, secrets, tokens, or production credentials.

The copy used normal `TRUNCATE ... CASCADE` and foreign-key dependency ordering. PostgreSQL administrative trigger settings were not changed.

## Migration workflow

1. Provision the new resource group, Log Analytics workspace, Container Apps environment, and PostgreSQL server.
2. Create the dev database and deploy the pinned backend image.
3. Allow backend migrations to create the dev schema.
4. Run the sanitization copy from the dev container, which has the required Azure network path.
5. Recreate the dev bootstrap administrator and require a password change on first login.
6. Deploy the pinned frontend image with the dev backend origin.
7. Configure dev CORS for the dev frontend hostname.
8. Remove temporary migration firewall rules.

## Verification checklist

- Both dev Container App revisions are `Healthy` and `Running`.
- Each dev app has 100% traffic on its latest revision.
- Frontend returns HTTP `200`.
- Backend `/docs` returns HTTP `200`.
- Frontend-to-backend CORS preflight returns HTTP `200` with the dev origin.
- Dev administrator login succeeds and reports `must_change_password=true`.
- Authenticated case access returns HTTP `200`.
- Sanitized data counts and relationships are present in dev.
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
