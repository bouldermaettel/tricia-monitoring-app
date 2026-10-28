#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_BLOB_URL:?Missing secure backup blob URL}"
: "${EXPECTED_SHA256:?Missing expected backup digest}"

DUMP_FILE=/tmp/backup-to-restore.dump
PGDATA_DIR=/tmp/restore-check-pgdata
curl --fail --silent --show-error --retry 3 "$BACKUP_BLOB_URL" --output "$DUMP_FILE"
ACTUAL_SHA256="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
[[ "$ACTUAL_SHA256" == "$EXPECTED_SHA256" ]] || {
  echo "Downloaded backup checksum did not match." >&2
  exit 1
}

install -d -o postgres -g postgres -m 700 "$PGDATA_DIR"
gosu postgres initdb -D "$PGDATA_DIR" --username=postgres --auth-local=trust --auth-host=trust >/dev/null
gosu postgres pg_ctl -D "$PGDATA_DIR" -o "-h 127.0.0.1 -k /tmp" -w start >/dev/null
cleanup() {
  gosu postgres pg_ctl -D "$PGDATA_DIR" -m fast -w stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

createdb -h 127.0.0.1 -U postgres migration_restore_check
pg_restore --exit-on-error --no-owner --no-privileges \
  --dbname postgresql://postgres@127.0.0.1/migration_restore_check "$DUMP_FILE"
COUNTS="$(psql -h 127.0.0.1 -U postgres -d migration_restore_check -At \
  -c "SELECT 'cases=' || count(*) FROM cases UNION ALL SELECT 'users=' || count(*) FROM users UNION ALL SELECT 'classification_snapshots=' || count(*) FROM classification_snapshots ORDER BY 1")"
echo "Isolated restore succeeded: ${COUNTS//$'\n'/, }"
