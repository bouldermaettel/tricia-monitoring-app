# Deployment Guide

This guide explains how to deploy the Tricia Monitoring App to Azure.

## Prerequisites

1.  **Azure CLI**: Installed and logged in (`az login`).
2.  **Permissions**: Contributor access to the target subscription and resource group.
3.  **Docker/ACR Build Permissions**: Ability to build images in Azure Container Registry.

## Deployment Script

The root directory contains a `deploy.sh` script that automates:
1.  Building backend and frontend images in ACR.
2.  Running the Bicep deployment for Azure Container Apps and PostgreSQL.

### Usage

```bash
./deploy.sh <namespace> [resource-group] [location] [parameters-file]
```

- **namespace**: A unique name for your deployment (e.g., `prod`, `staging`, `monitoring`). This is used to prefix resources.
- **resource-group**: (Optional) The target Azure Resource Group. Defaults to `monitoring-sandbox-rg`.
- **location**: (Optional) Azure region. Defaults to `switzerlandnorth`.
- **parameters-file**: (Optional) Path to a Bicep parameters JSON file. Defaults to `infra/parameters.json` when present.

### Environment Variables

If you are not using a parameters file, or if you want to override specific secrets, set these variables before running the script:

```bash
export SECRET_KEY='...'
export BOOTSTRAP_ADMIN_USERNAME='...'
export BOOTSTRAP_ADMIN_PASSWORD='...'
export POSTGRES_ADMIN_PASSWORD='...'
```

You can use the provided `env_deploy.sh` as a template (ensure it is NOT committed if it contains real secrets):

```bash
source env_deploy.sh
./deploy.sh monitoring
```

## Manual Deployment Steps

If you need to perform steps manually:

### 1. Build Images in ACR
```bash
az acr build --registry <acr-name> --image tricia-monitoring-backend:<tag> --file backend/Dockerfile .
az acr build --registry <acr-name> --image tricia-monitoring-frontend:<tag> --file frontend/Dockerfile .
```

### 2. Deploy Bicep
```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/archive/main.bicep \
  --parameters @infra/parameters.json \
  --parameters namespace=<namespace> \
  frontendImage=<acr-registry>/tricia-monitoring-frontend:<tag> \
  backendImage=<acr-registry>/tricia-monitoring-backend:<tag>
```

## Post-Deployment Verification

1.  **Check Revisions**: Run `az containerapp revision list` to ensure newest revisions are Provisioned and Healthy.
2.  **Hard Refresh**: After updating the frontend, users may need to hard refresh (Ctrl+F5) to clear cached JavaScript bundles.
3.  **Version Check**: Verify the version string in the application (defined in `frontend/package.json`).
