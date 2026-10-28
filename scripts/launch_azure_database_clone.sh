#!/usr/bin/env bash
set -euo pipefail
umask 077

# Run the PostgreSQL clone inside Azure, then securely download any dumps to
# the operator machine through a short-lived private container SAS.

usage() {
  echo "Usage: $0 <prod-to-dev|dev-to-prod|prod-backup> [--apply] [--verify-only] [--confirm-prod-replacement]"
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

SUBSCRIPTION="${SUBSCRIPTION:-7bd7ccec-546d-4bd0-a893-0e36681579d3}"
PROD_RG="${PROD_RG:-tricia-monitoring-rg}"
DEV_RG="${DEV_RG:-tricia-monitoring-dev-rg}"
PROD_BACKEND="${PROD_BACKEND:-tricia-monitoring-backend}"
DEV_BACKEND="${DEV_BACKEND:-tricia-monitoring-dev-backend}"
ACR_NAME="${ACR_NAME:-triciamonitoringacr}"
STORAGE_RG="${STORAGE_RG:-$DEV_RG}"
STORAGE_LOCATION="${STORAGE_LOCATION:-switzerlandnorth}"

case "$DIRECTION" in
  prod-backup)
    SOURCE_RG="$PROD_RG"; SOURCE_BACKEND="$PROD_BACKEND"
    RUN_RG="$PROD_RG"; SOURCE_NAME=prod; TARGET_NAME=backup; BACKUP_ONLY=1
    ;;
  prod-to-dev)
    SOURCE_RG="$PROD_RG"; SOURCE_BACKEND="$PROD_BACKEND"
    TARGET_RG="$DEV_RG"; TARGET_BACKEND="$DEV_BACKEND"
    RUN_RG="$DEV_RG"; SOURCE_NAME=prod; TARGET_NAME=dev
    ;;
  dev-to-prod)
    SOURCE_RG="$DEV_RG"; SOURCE_BACKEND="$DEV_BACKEND"
    TARGET_RG="$PROD_RG"; TARGET_BACKEND="$PROD_BACKEND"
    RUN_RG="$PROD_RG"; SOURCE_NAME=dev; TARGET_NAME=prod
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
command -v date >/dev/null 2>&1 || { echo "Missing required command: date" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "Missing required command: sha256sum" >&2; exit 1; }

get_secret() {
  local resource_group="$1" app="$2"
  az containerapp secret list --subscription "$SUBSCRIPTION" \
    --resource-group "$resource_group" --name "$app" --show-values \
    --query "[?name=='database-url'].value | [0]" --output tsv
}

echo "Retrieving database connection settings for ${DIRECTION}..."
SOURCE_DATABASE_URL="$(get_secret "$SOURCE_RG" "$SOURCE_BACKEND")"
[[ -n "$SOURCE_DATABASE_URL" ]] || { echo "Could not retrieve the source DB URL." >&2; exit 1; }
if [[ "$BACKUP_ONLY" != "1" ]]; then
  TARGET_DATABASE_URL="$(get_secret "$TARGET_RG" "$TARGET_BACKEND")"
  [[ -n "$TARGET_DATABASE_URL" ]] || { echo "Could not retrieve the target DB URL." >&2; exit 1; }
fi

TAG="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER_NAME="tricia-mig-${TAG,,}"
IMAGE_TAG="migration-${TAG,,}"
IMAGE="${ACR_NAME}.azurecr.io/tricia-monitoring-migration:${IMAGE_TAG}"
MIGRATION_BACKUP_DIR="/migration/migration-backups"
LOCAL_BACKUP_DIR="${MIGRATION_BACKUP_DIR_LOCAL:-${HOME:?HOME is not set}/tricia-monitoring-migration-backups}"
mkdir -p -m 700 "$LOCAL_BACKUP_DIR"

TRANSFER_ACCOUNT=""
TRANSFER_CONTAINER=""
TRANSFER_SAS=""
TRANSFER_URL=""
on_exit() {
  local status=$?
  if [[ "$status" != "0" && -n "$TRANSFER_ACCOUNT" ]]; then
    echo "Temporary transfer account retained for recovery/cleanup: ${TRANSFER_ACCOUNT} in ${STORAGE_RG}" >&2
    [[ -n "$TRANSFER_CONTAINER" ]] && echo "Transfer container: ${TRANSFER_CONTAINER}" >&2
    [[ -n "${CONTAINER_NAME:-}" ]] && echo "Migration runner: ${CONTAINER_NAME} in ${RUN_RG}" >&2
  fi
  exit "$status"
}
trap on_exit EXIT

if [[ "$APPLY" == "1" || "$BACKUP_ONLY" == "1" ]]; then
  # Account shared-key access is disabled by policy. Use Entra for account and
  # container operations, then issue a short-lived user-delegation SAS.
  TRANSFER_ACCOUNT="${TRANSFER_ACCOUNT_NAME:-triciaxfer26102827375}"
  if ! az storage account show --subscription "$SUBSCRIPTION" --resource-group "$STORAGE_RG" \
      --name "$TRANSFER_ACCOUNT" --output none 2>/dev/null; then
    az storage account create --subscription "$SUBSCRIPTION" --resource-group "$STORAGE_RG" \
      --name "$TRANSFER_ACCOUNT" --location "$STORAGE_LOCATION" --sku Standard_LRS --kind StorageV2 \
      --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false \
      --allow-shared-key-access false --public-network-access Enabled --output none
  fi
  TRANSFER_CONTAINER="${TRANSFER_CONTAINER_NAME:-tricia-migration-transfer}"
  az storage container create --account-name "$TRANSFER_ACCOUNT" --name "$TRANSFER_CONTAINER" \
    --auth-mode login --public-access off --output none
  SAS_START="$(date -u -d '-5 minutes' '+%Y-%m-%dT%H:%MZ')"
  EXPIRY="$(date -u -d '+4 hours' '+%Y-%m-%dT%H:%MZ')"
  TRANSFER_SAS="$(az storage container generate-sas --account-name "$TRANSFER_ACCOUNT" \
    --name "$TRANSFER_CONTAINER" --permissions racwdl --start "$SAS_START" \
    --expiry "$EXPIRY" --as-user --auth-mode login --https-only --output tsv)"
  TRANSFER_URL="https://${TRANSFER_ACCOUNT}.blob.core.windows.net/${TRANSFER_CONTAINER}?${TRANSFER_SAS}"
fi

echo "Building temporary migration image ${IMAGE_TAG}..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
az acr build --subscription "$SUBSCRIPTION" --registry "$ACR_NAME" \
  --image "tricia-monitoring-migration:${IMAGE_TAG}" \
  --file Dockerfile.migration "$REPO_ROOT" --no-logs

ACR_USERNAME="$(az acr credential show --subscription "$SUBSCRIPTION" --name "$ACR_NAME" \
  --query username --output tsv)"
ACR_PASSWORD="$(az acr credential show --subscription "$SUBSCRIPTION" --name "$ACR_NAME" \
  --query 'passwords[0].value' --output tsv)"

MIGRATION_ARGS=("--source-name" "$SOURCE_NAME" "--target-name" "$TARGET_NAME" \
  "--backup-dir" "$MIGRATION_BACKUP_DIR")
if [[ "$BACKUP_ONLY" == "1" ]]; then
  MIGRATION_ARGS+=("--backup-only")
elif [[ "$APPLY" == "1" ]]; then
  MIGRATION_ARGS+=("--apply")
  if [[ "$DIRECTION" == "prod-to-dev" ]]; then
    MIGRATION_ARGS+=("--backup-source")
  fi
elif [[ "$VERIFY_ONLY" == "1" ]]; then
  MIGRATION_ARGS+=("--verify-only")
fi

SECURE_ENV=("SOURCE_DATABASE_URL=$SOURCE_DATABASE_URL")
if [[ "$BACKUP_ONLY" != "1" ]]; then
  SECURE_ENV+=("TARGET_DATABASE_URL=$TARGET_DATABASE_URL")
fi
if [[ -n "$TRANSFER_URL" ]]; then
  SECURE_ENV+=("BACKUP_TRANSFER_CONTAINER_URL=$TRANSFER_URL")
fi

echo "Starting Azure migration container ${CONTAINER_NAME}..."
az container create --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
  --name "$CONTAINER_NAME" --image "$IMAGE" --os-type Linux --cpu 2 --memory 4 \
  --restart-policy Never --command-line "python /migration/clone_prod_to_dev.py ${MIGRATION_ARGS[*]}" \
  --ip-address Public --registry-login-server "${ACR_NAME}.azurecr.io" \
  --registry-username "$ACR_USERNAME" --registry-password "$ACR_PASSWORD" \
  --secure-environment-variables "${SECURE_ENV[@]}" --output none

while :; do
  STATE="$(az container show --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
    --name "$CONTAINER_NAME" --query instanceView.state --output tsv)"
  case "$STATE" in
    Succeeded|Terminated|Failed) break ;;
    *) sleep 10 ;;
  esac
done
az container logs --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
  --name "$CONTAINER_NAME"
EXIT_CODE="$(az container show --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
  --name "$CONTAINER_NAME" --query 'containers[0].instanceView.currentState.exitCode' --output tsv)"
if [[ "$EXIT_CODE" != "0" ]]; then
  echo "Migration failed with exit code ${EXIT_CODE:-unknown}; retained container ${CONTAINER_NAME}." >&2
  [[ -n "$TRANSFER_ACCOUNT" ]] && echo "Transfer account/container retained: ${TRANSFER_ACCOUNT}/${TRANSFER_CONTAINER}" >&2
  exit 1
fi

if [[ -n "$TRANSFER_ACCOUNT" ]]; then
  BLOB_NAMES="$(az storage blob list --account-name "$TRANSFER_ACCOUNT" --container-name "$TRANSFER_CONTAINER" \
    --sas-token "$TRANSFER_SAS" --query '[].name' --output tsv)"
  [[ -n "$BLOB_NAMES" ]] || { echo "Runner did not upload any backup dumps." >&2; exit 1; }
  if [[ "$BACKUP_ONLY" == "1" ]]; then
    RESTORE_BLOB="$(printf '%s\n' "$BLOB_NAMES" | head -n 1)"
    EXPECTED_SHA256="$(az storage blob show --account-name "$TRANSFER_ACCOUNT" --container-name "$TRANSFER_CONTAINER" \
      --name "$RESTORE_BLOB" --sas-token "$TRANSFER_SAS" --query metadata.sha256 --output tsv)"
    RESTORE_CONTAINER="tricia-restore-${TAG,,}"
    az container create --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
      --name "$RESTORE_CONTAINER" --image "$IMAGE" --os-type Linux --cpu 2 --memory 4 \
      --restart-policy Never --command-line "bash /migration/restore_backup_check.sh" \
      --ip-address Public --registry-login-server "${ACR_NAME}.azurecr.io" \
      --registry-username "$ACR_USERNAME" --registry-password "$ACR_PASSWORD" \
      --secure-environment-variables \
        "BACKUP_BLOB_URL=https://${TRANSFER_ACCOUNT}.blob.core.windows.net/${TRANSFER_CONTAINER}/${RESTORE_BLOB}?${TRANSFER_SAS}" \
        "EXPECTED_SHA256=$EXPECTED_SHA256" --output none
    while :; do
      RESTORE_STATE="$(az container show --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
        --name "$RESTORE_CONTAINER" --query instanceView.state --output tsv)"
      case "$RESTORE_STATE" in
        Succeeded|Terminated|Failed) break ;;
        *) sleep 10 ;;
      esac
    done
    az container logs --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
      --name "$RESTORE_CONTAINER"
    RESTORE_EXIT="$(az container show --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
      --name "$RESTORE_CONTAINER" --query 'containers[0].instanceView.currentState.exitCode' --output tsv)"
    if [[ "$RESTORE_EXIT" != "0" ]]; then
      echo "Isolated restore validation failed; backup transfer container is retained." >&2
      exit 1
    fi
    az container delete --subscription "$SUBSCRIPTION" --resource-group "$RUN_RG" \
      --name "$RESTORE_CONTAINER" --yes --output none
  fi
  while IFS= read -r blob_name; do
    [[ -n "$blob_name" ]] || continue
    local_file="$LOCAL_BACKUP_DIR/$blob_name"
    az storage blob download --account-name "$TRANSFER_ACCOUNT" --container-name "$TRANSFER_CONTAINER" \
      --name "$blob_name" --file "$local_file" --sas-token "$TRANSFER_SAS" --output none
    chmod 600 "$local_file"
    expected_size="$(az storage blob show --account-name "$TRANSFER_ACCOUNT" --container-name "$TRANSFER_CONTAINER" \
      --name "$blob_name" --sas-token "$TRANSFER_SAS" --query properties.contentLength --output tsv)"
    expected_hash="$(az storage blob show --account-name "$TRANSFER_ACCOUNT" --container-name "$TRANSFER_CONTAINER" \
      --name "$blob_name" --sas-token "$TRANSFER_SAS" --query metadata.sha256 --output tsv)"
    actual_size="$(wc -c < "$local_file" | tr -d '[:space:]')"
    actual_hash="$(sha256sum "$local_file" | awk '{print $1}')"
    [[ "$actual_size" == "$expected_size" && "$actual_hash" == "$expected_hash" ]] || {
      echo "Local backup verification failed for ${blob_name}; cloud copy retained." >&2
      exit 1
    }
    echo "Verified local backup: ${local_file}"
    az storage blob delete --account-name "$TRANSFER_ACCOUNT" --container-name "$TRANSFER_CONTAINER" \
      --name "$blob_name" --sas-token "$TRANSFER_SAS" --delete-snapshots include --output none
  done <<< "$BLOB_NAMES"
  echo "Temporary transfer blobs deleted; private container retained for subsequent migration steps: ${TRANSFER_ACCOUNT}/${TRANSFER_CONTAINER}"
fi

if [[ "$APPLY" == "1" && "$BACKUP_ONLY" != "1" && "${RESTART_TARGET_BACKEND:-1}" == "1" ]]; then
  REVISION="$(az containerapp revision list --subscription "$SUBSCRIPTION" \
    --resource-group "$TARGET_RG" --name "$TARGET_BACKEND" \
    --query '[?properties.active].name | [0]' --output tsv)"
  if [[ -n "$REVISION" ]]; then
    az containerapp revision restart --subscription "$SUBSCRIPTION" \
      --resource-group "$TARGET_RG" --revision "$REVISION" --output none
  fi
fi

echo "Runner retained for review: ${CONTAINER_NAME}"
