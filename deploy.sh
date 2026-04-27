#!/bin/bash

# Deploy Tricia Monitoring App to Azure Container Apps
# Pattern mirrors infra_example: ACR build + Bicep deployment.
# Usage:
#   ./deploy.sh <namespace> [resource-group] [location]
#
# Example:
#   ./deploy.sh team-a monitoring-sandbox-rg switzerlandnorth

set -euo pipefail

NAMESPACE="${1:-}"
RESOURCE_GROUP="${2:-monitoring-sandbox-rg}"
LOCATION="${3:-switzerlandnorth}"

if [ -z "$NAMESPACE" ]; then
  echo "❌ Missing namespace."
  echo "Usage: ./deploy.sh <namespace> [resource-group] [location]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

APP_BASE="tricia-${NAMESPACE}"
BACKEND_APP="${APP_BASE}-backend"
FRONTEND_APP="${APP_BASE}-frontend"
ACR_NAME="$(echo "tricia${NAMESPACE}acr" | tr -d '-')"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
BACKEND_IMAGE="${ACR_NAME}.azurecr.io/tricia-monitoring-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${ACR_NAME}.azurecr.io/tricia-monitoring-frontend:${IMAGE_TAG}"

echo "🚀 Deploying Tricia Monitoring App"
echo "   Namespace:      $NAMESPACE"
echo "   Resource group: $RESOURCE_GROUP"
echo "   Location:       $LOCATION"
echo "   ACR:            $ACR_NAME"
echo "   Image tag:      $IMAGE_TAG"
echo "   Project root:   $PROJECT_ROOT"

echo "🔍 Checking prerequisites..."
if ! command -v az >/dev/null 2>&1; then
  echo "❌ Azure CLI is not installed."
  exit 1
fi
if ! az account show >/dev/null 2>&1; then
  echo "❌ Not logged in to Azure. Run: az login"
  exit 1
fi
echo "✅ Prerequisites check passed"

echo "📦 Ensuring resource group exists..."
if ! az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
fi
echo "✅ Resource group ready"

echo "🏗️  Ensuring ACR exists..."
if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az acr create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$ACR_NAME" \
    --sku Basic \
    --admin-enabled true \
    --output none
fi
echo "✅ ACR ready"

echo "🔨 Building backend image in ACR..."
az acr build \
  --registry "$ACR_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "tricia-monitoring-backend:${IMAGE_TAG}" \
  --file backend/Dockerfile \
  "$PROJECT_ROOT"
echo "✅ Backend image built"

echo "🔨 Building frontend image in ACR..."
az acr build \
  --registry "$ACR_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "tricia-monitoring-frontend:${IMAGE_TAG}" \
  --build-arg "VITE_API_BASE_URL=/api/v1" \
  --file frontend/Dockerfile \
  "$PROJECT_ROOT"
echo "✅ Frontend image built"

if [ -z "${SECRET_KEY:-}" ] || [ -z "${BOOTSTRAP_ADMIN_USERNAME:-}" ] || [ -z "${BOOTSTRAP_ADMIN_PASSWORD:-}" ] || [ -z "${POSTGRES_ADMIN_PASSWORD:-}" ]; then
  echo "❌ Required env vars missing."
  echo "Set these before running:"
  echo "   export SECRET_KEY='...'"
  echo "   export BOOTSTRAP_ADMIN_USERNAME='...'"
  echo "   export BOOTSTRAP_ADMIN_PASSWORD='...'"
  echo "   export POSTGRES_ADMIN_PASSWORD='...'"
  echo "Optional:"
  echo "   export POSTGRES_ADMIN_USERNAME='triciaadmin'"
  echo "   export POSTGRES_DATABASE_NAME='tricia_monitoring'"
  echo "   export POSTGRES_SKU_NAME='Standard_B1ms'"
  echo "   export POSTGRES_SKU_TIER='Burstable'"
  echo "   export POSTGRES_STORAGE_GB='32'"
  echo "   export POSTGRES_VERSION='16'"
  echo "   export BOOTSTRAP_ADMIN_DISPLAY_NAME='System Admin'"
  echo "   export CORS_ORIGINS='https://your-frontend-url'"
  exit 1
fi

echo "🚀 Deploying infrastructure (Bicep)..."
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$PROJECT_ROOT/infra/main.bicep" \
  --parameters namespace="$NAMESPACE" \
               location="$LOCATION" \
               backendImage="$BACKEND_IMAGE" \
               frontendImage="$FRONTEND_IMAGE" \
               secretKey="$SECRET_KEY" \
               postgresAdminUsername="${POSTGRES_ADMIN_USERNAME:-triciaadmin}" \
               postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD" \
               postgresDatabaseName="${POSTGRES_DATABASE_NAME:-tricia_monitoring}" \
               postgresSkuName="${POSTGRES_SKU_NAME:-Standard_B1ms}" \
               postgresSkuTier="${POSTGRES_SKU_TIER:-Burstable}" \
               postgresStorageGb="${POSTGRES_STORAGE_GB:-32}" \
               postgresVersion="${POSTGRES_VERSION:-16}" \
               bootstrapAdminUsername="$BOOTSTRAP_ADMIN_USERNAME" \
               bootstrapAdminPassword="$BOOTSTRAP_ADMIN_PASSWORD" \
               bootstrapAdminDisplayName="${BOOTSTRAP_ADMIN_DISPLAY_NAME:-System Admin}" \
               corsOrigins="${CORS_ORIGINS:-}" \
  --output none
echo "✅ Bicep deployment complete"

BACKEND_URL=$(az containerapp show \
  --name "$BACKEND_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv 2>/dev/null || echo "")

if [ -n "$BACKEND_URL" ]; then
  echo "🔁 Rebuilding frontend with concrete backend URL..."
  az acr build \
    --registry "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "tricia-monitoring-frontend:${IMAGE_TAG}" \
    --build-arg "VITE_API_BASE_URL=https://${BACKEND_URL}/api/v1" \
    --file frontend/Dockerfile \
    "$PROJECT_ROOT"
  echo "✅ Frontend rebuilt for backend URL"
fi

echo "🔄 Forcing fresh revisions..."
az containerapp update \
  --name "$BACKEND_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars "DEPLOY_TIMESTAMP=$(date +%s)" \
  --output none

az containerapp update \
  --name "$FRONTEND_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars "DEPLOY_TIMESTAMP=$(date +%s)" \
  --output none
echo "✅ Revisions updated"

BACKEND_URL=$(az containerapp show \
  --name "$BACKEND_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv 2>/dev/null || echo "")

FRONTEND_URL=$(az containerapp show \
  --name "$FRONTEND_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv 2>/dev/null || echo "")

echo ""
echo "🎉 Deployment completed"
echo "Backend:  https://${BACKEND_URL}"
echo "Frontend: https://${FRONTEND_URL}"
echo ""
echo "📊 Logs:"
echo "   az containerapp logs show --name $BACKEND_APP --resource-group $RESOURCE_GROUP --follow"
echo "   az containerapp logs show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --follow"
