# PROD and DEV data migration runbook

This runbook describes a reversible PROD→DEV clone followed by promotion of
the validated DEV dataset and the exact running DEV app images to PROD. It does
not itself authorize or execute a production deployment.

## Environments

The live productive split frontend/backend deployment is in subscription
`smc-sandbox-smc-four-point-zero`, resource group `tricia-monitoring-rg`:

- Frontend: `tricia-monitoring-frontend`
- Backend: `tricia-monitoring-backend`
- PostgreSQL: `tricia-monitoring-pg`

DEV is in `tricia-monitoring-dev-rg`:

- Frontend: `tricia-monitoring-dev-frontend`
- Backend: `tricia-monitoring-dev-backend`
- PostgreSQL: `tricia-monitoring-dev-pg`

Do not use the archived Bicep deployment to infer the live configuration.
DEV has separate database credentials, JWT secret, bootstrap credentials,
and CORS configuration.

## Clone utility and local backups

`scripts/clone_prod_to_dev.py` is direction-neutral despite its historical
filename. It is dry-run by default, rejects identical database URLs, checks
table and column compatibility, preserves all public application tables
including users, resets sequences, and verifies counts and shared-column row
contents. Use `--verify-only` only after source and target are expected to
match.

Every apply run first creates a custom-format `pg_dump` of the target in the
operator's local backup directory. PROD→DEV apply also creates a source PROD
dump. By default, files are stored under
`$HOME/tricia-monitoring-migration-backups`; override this with
`MIGRATION_BACKUP_DIR`. The directory is created with owner-only access and
dump files use mode `0600`. Keep the dumps locally for 30 days, then delete
them. Record the file paths and app image references in the migration log.

The launcher `scripts/launch_database_clone.sh` runs the migration directly
from the operator's machine and reads database secrets through the Azure CLI.
The machine needs `az`, `pg_dump`, Python dependencies, and network access to
both PostgreSQL servers. It does not pause the apps or deploy images. Check
database connectivity during preflight; if the local machine cannot reach the
servers, do not apply the clone until connectivity has been arranged.

## Runbook

1. **Preflight.** Confirm PROD and DEV identities, current app image references
   (prefer immutable digests), active revisions, schema revisions, and database
   reachability. Ensure the local backup directory has enough free space. Take
   a separate PROD backup and restore it to an isolated database; verify the
   restored schema and counts before proceeding:

   ```bash
   bash scripts/launch_database_clone.sh prod-backup --apply
   ```

2. **Freeze PROD writes.** Pause case creation, imports, and any other database
   writes for the initial clone. Keep PROD serving read-only if that is
   supported operationally; otherwise use a brief maintenance window.
3. **Inspect PROD→DEV.** Run the dry-run command below. Review source/target
   schema revisions, full column lists, table counts, and compatibility errors.
   Resolve unsupported schema differences first.
4. **Clone PROD→DEV.** Apply the clone. The existing target DEV database is
   backed up locally before replacement. Keep DEV read-only during validation.
5. **Validate DEV.** Confirm table/column structure, row counts, row contents
   on all shared columns, foreign keys, and complete user rows including
   password hashes. Confirm `user_p = tricia_p`, `tri_risk = tricia_s *
   tricia_p * tricia_d`, and `wimi_risk = user_s * user_p * user_d` wherever
   inputs are complete. Verify UI rendering, login, and authenticated case
   access without creating or editing records. Keep PROD writes paused until
   final cutover so both environments represent the same data snapshot.
6. **Prepare PROD image deployment.** Record the immutable frontend and
   backend image references currently running in DEV:

   ```bash
   az containerapp show --name tricia-monitoring-dev-backend \
     --resource-group tricia-monitoring-dev-rg \
     --query 'properties.template.containers[].image' --output tsv
   az containerapp show --name tricia-monitoring-dev-frontend \
     --resource-group tricia-monitoring-dev-rg \
     --query 'properties.template.containers[].image' --output tsv
   ```

   Before deploying to PROD, obtain the required explicit PROD confirmation.
   Deploy those exact images to the existing PROD apps without changing PROD
   secrets or database target. The deployment script accepts independent image
   references so frontend and backend do not need to share a tag:

   ```bash
   ENV_FILE=.env.tricia-prod ./deploy-live.sh prod \
     '<backend-image-reference>' '<frontend-image-reference>'
   ```

   Wait for healthy revisions and confirm the backend migrations have advanced
   PROD to the DEV schema revision. Do not continue if schemas differ or apps
   are unhealthy.
7. **Freeze DEV writes and clone DEV→PROD.** Run the final dry run, inspect the
   report, then apply with the explicit production replacement guard below.
   This first saves a fresh PROD database backup locally. The process checks
   counts, shared-column contents, derived values, and foreign keys before
   committing.
8. **Accept and unfreeze.** Verify PROD counts and data against the validated
   DEV snapshot; check login, case totals, UI, and app health. Resume PROD
   writes only after these checks pass. Retain the local PROD backup for 30
   days. If validation fails, keep writes paused, restore the pre-cutover PROD
   dump to an isolated database first, and follow the approved production
   recovery procedure.

Dry-run / inspection:

```bash
bash scripts/launch_database_clone.sh prod-to-dev
```

Apply PROD→DEV after write freeze:

```bash
bash scripts/launch_database_clone.sh prod-to-dev --apply
```

Verify a completed copy:

```bash
bash scripts/launch_database_clone.sh prod-to-dev --verify-only
```

After deploying the DEV app images to PROD and freezing writes in both
environments, inspect then apply DEV→PROD:

```bash
bash scripts/launch_database_clone.sh dev-to-prod
bash scripts/launch_database_clone.sh dev-to-prod --apply --confirm-prod-replacement
```

The production data replacement guard prevents accidental DEV→PROD apply
without `--confirm-prod-replacement`. It is separate from, and does not replace,
the explicit approval required before deploying application images to PROD.

## Restore procedure

Restore the exact local target dump into an isolated PostgreSQL database first,
never directly over PROD as a first step:

```bash
pg_restore --no-owner --clean --if-exists --dbname "$RESTORE_DATABASE_URL" \
  "$HOME/tricia-monitoring-migration-backups/<timestamp>-prod-database-backup.dump"
```

Verify the restored schema revision, table counts, and application access in
isolation. Restoring over the live PROD database is a separate destructive
operation and must follow the production recovery approval process.

## Infrastructure notes

The live application configuration is managed by `infra/live/main.bicep` and
`deploy-live.sh`, which use environment files that are intentionally
uncommitted. The clone launcher does not use the archived Bicep template and
does not alter app configuration. Never commit database dumps, database URLs,
or production secrets.
