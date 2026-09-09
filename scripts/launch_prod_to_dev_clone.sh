#!/usr/bin/env bash
set -euo pipefail

# Build and run the full prod-to-dev clone in a one-shot Azure Container
# Instance. Database URLs are passed only as secure container environment
# variables and are never printed. The backup remains in the stopped container.

SUBSCRIPTION="${SUBSCRIPTION:-7bd7ccec-546d-4bd0-a893-0e36681579d3}"
PROD_RG="${PROD_RG:-tricia-monitoring-rg}"
DEV_RG="${DEV_RG:-tricia-monitoring-dev-rg}"
PROD_BACKEND="${PROD_BACKEND:-tricia-monitoring-backend}"
DEV_BACKEND="${DEV_BACKEND:-tricia-monitoring-dev-backend}"
ACR_NAME="${ACR_NAME:-triciamonitoringacr}"
KEEP_CONTAINER="${KEEP_CONTAINER:-1}"
RESTART_DEV_BACKEND="${RESTART_DEV_BACKEND:-1}"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require_command az
require_command date

TAG="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER_NAME="tricia-monitoring-clone-${TAG,,}"
IMAGE_TAG="migration-${TAG,,}"
IMAGE="${ACR_NAME}.azurecr.io/tricia-monitoring-migration:${IMAGE_TAG}"

cleanup() {
  local status=$?
  if [[ "$KEEP_CONTAINER" != "1" && -n "${CONTAINER_NAME:-}" ]]; then
    az container delete --subscription "$SUBSCRIPTION" --resource-group "$DEV_RG" \
      --name "$CONTAINER_NAME" --yes --output none || true
  fi
  exit "$status"
}
trap cleanup EXIT

get_secret() {
  local resource_group="$1" app="$2"
  az containerapp secret list --subscription "$SUBSCRIPTION" \
    --resource-group "$resource_group" --name "$app" --show-values \
    --query "[?name=='database-url'].value | [0]" --output tsv
}

echo "Retrieving database secret references..."
PROD_DATABASE_URL="$(get_secret "$PROD_RG" "$PROD_BACKEND")"
DEV_DATABASE_URL="$(get_secret "$DEV_RG" "$DEV_BACKEND")"
[[ -n "$PROD_DATABASE_URL" && -n "$DEV_DATABASE_URL" ]] || {
  echo "Could not retrieve both database URLs." >&2
  exit 1
}

echo "Building migration image ${IMAGE_TAG}..."
az acr build --subscription "$SUBSCRIPTION" --registry "$ACR_NAME" \
  --image "tricia-monitoring-migration:${IMAGE_TAG}" \
  --file Dockerfile.migration . --no-logs

ACR_USERNAME="$(az acr credential show --subscription "$SUBSCRIPTION" --name "$ACR_NAME" \
  --query username --output tsv)"
ACR_PASSWORD="$(az acr credential show --subscription "$SUBSCRIPTION" --name "$ACR_NAME" \
  --query 'passwords[0].value' --output tsv)"

echo "Starting dedicated migration container..."
az container create --subscription "$SUBSCRIPTION" --resource-group "$DEV_RG" \
  --name "$CONTAINER_NAME" --image "$IMAGE" --os-type Linux --cpu 1 --memory 2 \
  --restart-policy Never --command-line "python /migration/clone_prod_to_dev.py --apply" \
  --ip-address Public --ports 80 \
  --registry-login-server "${ACR_NAME}.azurecr.io" \
  --registry-username "$ACR_USERNAME" --registry-password "$ACR_PASSWORD" \
  --secure-environment-variables \
    SOURCE_DATABASE_URL="$PROD_DATABASE_URL" \
    TARGET_DATABASE_URL="$DEV_DATABASE_URL" \
  --output none

while :; do
  STATE="$(az container show --subscription "$SUBSCRIPTION" --resource-group "$DEV_RG" \
    --name "$CONTAINER_NAME" --query instanceView.currentState.state --output tsv)"
  case "$STATE" in
    Succeeded|Terminated|Failed) break ;;
    *) sleep 5 ;;
  esac
done

az container logs --subscription "$SUBSCRIPTION" --resource-group "$DEV_RG" \
  --name "$CONTAINER_NAME"
EXIT_CODE="$(az container show --subscription "$SUBSCRIPTION" --resource-group "$DEV_RG" \
  --name "$CONTAINER_NAME" --query instanceView.currentState.exitCode --output tsv)"
if [[ "$EXIT_CODE" != "0" ]]; then
  echo "Migration failed with exit code ${EXIT_CODE:-unknown}. The stopped container and backup are retained." >&2
  exit 1
fi

if [[ "$RESTART_DEV_BACKEND" == "1" ]]; then
  REVISION="$(az containerapp revision list --subscription "$SUBSCRIPTION" \
    --resource-group "$DEV_RG" --name "$DEV_BACKEND" \
    --query '[?properties.active].name | [0]' --output tsv)"
  if [[ -n "$REVISION" ]]; then
    az containerapp revision restart --subscription "$SUBSCRIPTION" \
      --resource-group "$DEV_RG" --revision "$REVISION" --output none
  fi
fi

echo "Migration succeeded. The stopped container and backup are retained."
echo "Container: ${CONTAINER_NAME}"
