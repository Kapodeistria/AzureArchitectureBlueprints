#!/bin/bash
set -e

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-agentic-waf}"
WEBAPP_NAME="${AZURE_WEBAPP_NAME:-agenticwaf-webapp}"

echo "📦 Installing dependencies..."
cd "$(dirname "$0")"
npm install

echo "🏗️ Building application..."
npm run build

echo "📤 Deploying to Azure Web App: $WEBAPP_NAME..."

# Create deployment zip
echo "Creating deployment package..."
zip -r deploy.zip . -x "*.git*" "node_modules/*" ".env*" "deploy.sh"

# Deploy to Azure
echo "Uploading to Azure..."
az webapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --src deploy.zip

# Clean up
rm deploy.zip

echo "✅ Deployment complete!"
echo "🌐 Web App URL: https://$WEBAPP_NAME.azurewebsites.net"

# Restart web app to apply changes
echo "🔄 Restarting web app..."
az webapp restart --resource-group "$RESOURCE_GROUP" --name "$WEBAPP_NAME"

echo "✅ Done! Your web app is now running."