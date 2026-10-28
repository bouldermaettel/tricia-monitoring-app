#!/usr/bin/env bash
set -euo pipefail
umask 077

# Run the migration from the operator's machine so custom-format database
# backups remain locally available for the agreed retention period.

usage() {
  echo "Usage: $0 <prod-to-dev|dev-to-prod|prod-backup> [--apply] [--verify-only] [--confirm-prod-replacement]"
  echo "Set MIGRATION_BACKUP_DIR to choose a local backup directory."
}

[[ $# -ge 1 ]] || { usage >&2; exit 2; }
DIRECTION="$1"
shift
APPLY=0
CONFIRM_PROD=0
VERIFY_ONLY=0
BACKUP_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --confirm-prod-replacement) CONFIRM_PROD=1 ;;
    --verify-only) VERIFY_ONLY=1 ;;
    *) usage >&2; exit 2 ;;
  esac
done

case "$DIRECTION" in
  prod-to-dev)
    SOURCE_RG="${PROD_RG:-tricia-monitoring-rg}"
    SOURCE_BACKEND="${PROD_BACKEND:-tricia-monitoring-backend}"
    TARGET_RG="${DEV_RG:-tricia-monitoring-dev-rg}"
    TARGET_BACKEND="${DEV_BACKEND:-tricia-monitoring-dev-backend}"
    SOURCE_NAME=prod
    TARGET_NAME=dev
    ;;
  prod-backup)
    SOURCE_RG="${PROD_RG:-tricia-monitoring-rg}"
    SOURCE_BACKEND="${PROD_BACKEND:-tricia-monitoring-backend}"
    SOURCE_NAME=prod
    TARGET_NAME=backup
    BACKUP_ONLY=1
    ;;
  dev-to-prod)
    SOURCE_RG="${DEV_RG:-tricia-monitoring-dev-rg}"
    SOURCE_BACKEND="${DEV_BACKEND:-tricia-monitoring-dev-backend}"
    TARGET_RG="${PROD_RG:-tricia-monitoring-rg}"
    TARGET_BACKEND="${PROD_BACKEND:-tricia-monitoring-backend}"
    SOURCE_NAME=dev
    TARGET_NAME=prod
    if [[ "$APPLY" == "1" && "$CONFIRM_PROD" != "1" ]]; then
      echo "Refusing DEV-to-PROD replacement without --confirm-prod-replacement." >&2
      exit 2
    fi
    ;;
  *) usage >&2; exit 2 ;;
esac
if [[ "$APPLY" == "1" && "$VERIFY_ONLY" == "1" ]]; then
  echo "--apply and --verify-only cannot be combined." >&2
  exit 2
fi
if [[ "$BACKUP_ONLY" == "1" && ( "$APPLY" != "1" || "$VERIFY_ONLY" == "1" ) ]]; then
  echo "prod-backup requires --apply and cannot use --verify-only." >&2
  exit 2
fi

command -v az >/dev/null 2>&1 || { echo "Missing required command: az" >&2; exit 1; }
if [[ "$APPLY" == "1" || "$BACKUP_ONLY" == "1" ]]; then
  command -v pg_dump >/dev/null 2>&1 || {
    echo "pg_dump is required for local database backups." >&2
    exit 1
  }
fi
OPERATOR_HOME="${HOME:?HOME is not set}"
MIGRATION_BACKUP_DIR="${MIGRATION_BACKUP_DIR:-$OPERATOR_HOME/tricia-monitoring-migration-backups}"
mkdir -p -m 700 "$MIGRATION_BACKUP_DIR"

get_secret() {
  local resource_group="$1" app="$2"
  az containerapp secret list --subscription "${SUBSCRIPTION:-7bd7ccec-546d-4bd0-a893-0e36681579d3}" \
    --resource-group "$resource_group" --name "$app" --show-values \
    --query "[?name=='database-url'].value | [0]" --output tsv
}

echo "Retrieving database connection settings for ${DIRECTION}..."
SOURCE_DATABASE_URL="$(get_secret "$SOURCE_RG" "$SOURCE_BACKEND")"
[[ -n "$SOURCE_DATABASE_URL" ]] || {
  echo "Could not retrieve the source database URL." >&2
  exit 1
}
if [[ "$BACKUP_ONLY" != "1" ]]; then
  TARGET_DATABASE_URL="$(get_secret "$TARGET_RG" "$TARGET_BACKEND")"
  [[ -n "$TARGET_DATABASE_URL" ]] || {
    echo "Could not retrieve the target database URL." >&2
    exit 1
  }
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -n "${PYTHON:-}" ]]; then
  PYTHON_BIN="$PYTHON"
elif [[ -x "$REPO_ROOT/backend/.venv/bin/python" ]]; then
  PYTHON_BIN="$REPO_ROOT/backend/.venv/bin/python"
else
  PYTHON_BIN="python3"
fi
command -v "$PYTHON_BIN" >/dev/null 2>&1 || {
  echo "Missing Python interpreter: $PYTHON_BIN" >&2
  exit 1
}
MIGRATION_ARGS=(
  --source-name "$SOURCE_NAME"
  --target-name "$TARGET_NAME"
  --backup-dir "$MIGRATION_BACKUP_DIR"
)
if [[ "$BACKUP_ONLY" == "1" ]]; then
  MIGRATION_ARGS+=(--backup-only)
elif [[ "$APPLY" == "1" ]]; then
  MIGRATION_ARGS+=(--apply)
  if [[ "$DIRECTION" == "prod-to-dev" ]]; then
    MIGRATION_ARGS+=(--backup-source)
  fi
elif [[ "$VERIFY_ONLY" == "1" ]]; then
  MIGRATION_ARGS+=(--verify-only)
fi

echo "Local backups will be stored in: ${MIGRATION_BACKUP_DIR}"
export SOURCE_DATABASE_URL
if [[ "$BACKUP_ONLY" != "1" ]]; then
  export TARGET_DATABASE_URL
fi
export MIGRATION_BACKUP_DIR
"$PYTHON_BIN" "$SCRIPT_DIR/clone_prod_to_dev.py" "${MIGRATION_ARGS[@]}"

if [[ "$APPLY" == "1" && "$BACKUP_ONLY" != "1" && "${RESTART_TARGET_BACKEND:-1}" == "1" ]]; then
  REVISION="$(az containerapp revision list --subscription "${SUBSCRIPTION:-7bd7ccec-546d-4bd0-a893-0e36681579d3}" \
    --resource-group "$TARGET_RG" --name "$TARGET_BACKEND" \
    --query '[?properties.active].name | [0]' --output tsv)"
  if [[ -n "$REVISION" ]]; then
    az containerapp revision restart --subscription "${SUBSCRIPTION:-7bd7ccec-546d-4bd0-a893-0e36681579d3}" \
      --resource-group "$TARGET_RG" --revision "$REVISION" --output none
  fi
fi
