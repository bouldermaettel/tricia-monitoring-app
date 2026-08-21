#!/usr/bin/env bash

# Deploy the live Tricia Monitoring prod/dev Container Apps configuration.
# This manages the existing live resources; it does not create or copy databases.
#
# Usage:
#   ENV_FILE=.env.tricia-dev ./deploy-live.sh dev [image-tag]
#   ENV_FILE=.env.tricia-prod ./deploy-live.sh prod [image-tag]
#   WHAT_IF=1 ENV_FILE=.env.tricia-dev ./deploy-live.sh dev

set -euo pipefail

TARGET="${1:-}"
IMAGE_TAG="${2:-20260722161758}"

if [[ "$TARGET" != "prod" && "$TARGET" != "dev" ]]; then
  echo "Usage: ENV_FILE=<untracked-secret-file> ./deploy-live.sh <prod|dev> [image-tag]"
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-}"
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Secret environment file not found: $ENV_FILE" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

case "$TARGET" in
  prod)
    RESOURCE_GROUP="tricia-monitoring-rg"
    APP_BASE="tricia-monitoring"
    ;;
  dev)
    RESOURCE_GROUP="tricia-monitoring-dev-rg"
    APP_BASE="tricia-monitoring-dev"
    ;;
esac

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required variable: $name" >&2
    exit 1
  fi
}

require_var DATABASE_URL
require_var SECRET_KEY
require_var BOOTSTRAP_ADMIN_USERNAME
require_var BOOTSTRAP_ADMIN_PASSWORD

BACKEND_APP="${APP_BASE}-backend"
FRONTEND_APP="${APP_BASE}-frontend"
ACR_NAME="${ACR_NAME:-triciamonitoringacr}"
BACKEND_IMAGE="${ACR_NAME}.azurecr.io/tricia-monitoring-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${ACR_NAME}.azurecr.io/tricia-monitoring-frontend:${IMAGE_TAG}"

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI is required." >&2
  exit 1
fi

if [[ -z "${BACKEND_API_ORIGIN:-}" ]]; then
  BACKEND_API_ORIGIN="$(az containerapp show --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true)"
  [[ -n "$BACKEND_API_ORIGIN" ]] && BACKEND_API_ORIGIN="https://${BACKEND_API_ORIGIN}"
fi
if [[ -z "${CORS_ORIGINS:-}" ]]; then
  CORS_ORIGINS="$(az containerapp show --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true)"
  [[ -n "$CORS_ORIGINS" ]] && CORS_ORIGINS="https://${CORS_ORIGINS}"
fi
require_var BACKEND_API_ORIGIN
require_var CORS_ORIGINS

DEPLOY_TIMESTAMP="$(date +%s)"
PARAMETERS=(
  environment="$TARGET"
  backendImage="$BACKEND_IMAGE"
  frontendImage="$FRONTEND_IMAGE"
  databaseUrl="$DATABASE_URL"
  secretKey="$SECRET_KEY"
  bootstrapAdminUsername="$BOOTSTRAP_ADMIN_USERNAME"
  bootstrapAdminPassword="$BOOTSTRAP_ADMIN_PASSWORD"
  bootstrapAdminDisplayName="${BOOTSTRAP_ADMIN_DISPLAY_NAME:-Tricia Admin}"
  corsOrigins="$CORS_ORIGINS"
  backendApiOrigin="$BACKEND_API_ORIGIN"
  deployTimestamp="$DEPLOY_TIMESTAMP"
  acrName="$ACR_NAME"
)

if [[ "${WHAT_IF:-0}" == "1" ]]; then
  az deployment group what-if \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$SCRIPT_DIR/infra/live/main.bicep" \
    --parameters "${PARAMETERS[@]}"
  exit 0
fi

az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$SCRIPT_DIR/infra/live/main.bicep" \
  --parameters "${PARAMETERS[@]}" \
  --output none

BACKEND_FQDN="$(az containerapp show --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)"
FRONTEND_FQDN="$(az containerapp show --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)"

echo "Deployment complete: $TARGET"
echo "Backend:  https://${BACKEND_FQDN}"
echo "Frontend: https://${FRONTEND_FQDN}"
