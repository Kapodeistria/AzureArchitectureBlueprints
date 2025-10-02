#!/usr/bin/env bash
set -e

STORAGE_ACCOUNT="${STORAGE_ACCOUNT_NAME:-agenticwafartifactsthkyg}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-kapodeistria-3079}"
CONTAINER_NAME="final-artifacts"

echo "🔑 Setting up Azure Storage credentials..."
echo "   Storage Account: $STORAGE_ACCOUNT"
echo "   Resource Group:  $RESOURCE_GROUP"
echo ""

if ! command -v az >/dev/null 2>&1; then
  echo "❌ Azure CLI (az) is required but not installed."
  echo "   Install from: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli"
  exit 1
fi

# Check if logged in
if ! az account show >/dev/null 2>&1; then
  echo "❌ Not logged into Azure CLI."
  echo "   Run: az login"
  exit 1
fi

echo "📥 Fetching connection string..."
CONNECTION_STRING=$(az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString \
  -o tsv 2>/dev/null)

if [ -z "$CONNECTION_STRING" ]; then
  echo "❌ Failed to retrieve connection string."
  echo "   Check that storage account exists and you have permissions."
  exit 1
fi

echo "✅ Connection string retrieved!"
echo ""

# Generate SAS token (valid for 1 year)
echo "🔐 Generating SAS token (valid for 1 year)..."
EXPIRY_DATE=$(date -u -v+1y '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -d "1 year" '+%Y-%m-%dT%H:%MZ')

SAS_TOKEN=$(az storage container generate-sas \
  --account-name "$STORAGE_ACCOUNT" \
  --name "$CONTAINER_NAME" \
  --permissions acdlrw \
  --expiry "$EXPIRY_DATE" \
  --connection-string "$CONNECTION_STRING" \
  -o tsv 2>/dev/null)

if [ -z "$SAS_TOKEN" ]; then
  echo "⚠️  Could not generate SAS token (container may not exist)."
  echo "   Connection string is sufficient for local development."
else
  echo "✅ SAS token generated (expires: $EXPIRY_DATE)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Add these to your .env.local file:"
echo ""
echo "# Azure Storage Configuration"
echo "ARTIFACTS_STORAGE_CONNECTION=\"$CONNECTION_STRING\""
echo "STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT"
echo "ARTIFACTS_CONTAINER=$CONTAINER_NAME"

if [ -n "$SAS_TOKEN" ]; then
  echo ""
  echo "# Alternative: Use SAS token instead of connection string"
  echo "# ARTIFACTS_STORAGE_SAS=\"$SAS_TOKEN\""
  echo "# STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Offer to copy to clipboard
if command -v pbcopy >/dev/null 2>&1; then
  echo "💾 Copy connection string to clipboard? (y/n)"
  read -r answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    echo "ARTIFACTS_STORAGE_CONNECTION=\"$CONNECTION_STRING\"" | pbcopy
    echo "✅ Copied to clipboard!"
  fi
elif command -v xclip >/dev/null 2>&1; then
  echo "💾 Copy connection string to clipboard? (y/n)"
  read -r answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    echo "ARTIFACTS_STORAGE_CONNECTION=\"$CONNECTION_STRING\"" | xclip -selection clipboard
    echo "✅ Copied to clipboard!"
  fi
fi

echo ""
echo "📚 See docs/STORAGE-SAS-SETUP.md for more configuration options."
echo "✅ Setup complete!"
