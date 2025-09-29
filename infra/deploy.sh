#!/bin/bash
set -e

# Configuration from environment variables or defaults
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-agentic-waf}"
TEMPLATE_FILE="${BICEP_TEMPLATE_FILE:-infra/bicep/main.bicep}"
PARAMETERS_FILE="${BICEP_PARAMETERS_FILE:-infra/bicep/main.parameters.json}"

# Validate required variables
if [ -z "$AZURE_SUBSCRIPTION_ID" ]; then
  echo "Error: AZURE_SUBSCRIPTION_ID environment variable is required" >&2
  echo "Set it with: export AZURE_SUBSCRIPTION_ID=<your-subscription-id>" >&2
  exit 1
fi

echo "Deploying infrastructure to $RESOURCE_GROUP..."

# Use deployment name with timestamp to avoid conflicts
DEPLOYMENT_NAME="infra-deploy-$(date +%s)"

# Deploy without capturing JSON output to avoid Azure CLI bug
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOYMENT_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "$PARAMETERS_FILE" \
  --output none

echo ""
echo "Deployment initiated: $DEPLOYMENT_NAME"
echo "Checking deployment status..."

# Wait and check status
az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOYMENT_NAME" \
  --query '{state:properties.provisioningState, outputs:properties.outputs}' \
  --output table