# Azure Storage SAS Token Setup Guide

## Overview

The application uses Azure Blob Storage to store generated case study artifacts (markdown files, JSON reports, etc.). Files are uploaded by the worker container and served via public URLs by the web app.

## Storage Architecture

- **Storage Account**: `agenticwafartifactsthkyg`
- **Container**: `final-artifacts`
- **Access Method**: SAS token (Shared Access Signature) or Connection String

## Getting SAS Token or Connection String

### Option 1: Generate SAS Token (Recommended for Production)

Generate a container-level SAS token with read/write permissions:

```bash
# Set variables
STORAGE_ACCOUNT="agenticwafartifactsthkyg"
CONTAINER_NAME="final-artifacts"
RESOURCE_GROUP="rg-kapodeistria-3079"

# Generate SAS token (valid for 1 year)
az storage container generate-sas \
  --account-name "$STORAGE_ACCOUNT" \
  --name "$CONTAINER_NAME" \
  --permissions acdlrw \
  --expiry $(date -u -d "1 year" '+%Y-%m-%dT%H:%MZ') \
  --auth-mode key \
  --as-user \
  -o tsv
```

This will output a SAS token like:
```
se=2026-01-01T00%3A00Z&sp=racwdl&sv=2022-11-02&sr=c&sig=XXXXXXXXXXXXX
```

### Option 2: Use Connection String (Simpler for Development)

Get the full connection string (includes account key):

```bash
az storage account show-connection-string \
  --name agenticwafartifactsthkyg \
  --resource-group rg-kapodeistria-3079 \
  --query connectionString \
  -o tsv
```

## Environment Variable Configuration

### Local Development

Add to your `.env.local` file:

```bash
# Option 1: Use SAS Token
ARTIFACTS_STORAGE_SAS="se=2026-01-01T00%3A00Z&sp=racwdl&sv=2022-11-02&sr=c&sig=XXX"
STORAGE_ACCOUNT_NAME=agenticwafartifactsthkyg

# Option 2: Use Connection String (easier)
ARTIFACTS_STORAGE_CONNECTION="DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=agenticwafartifactsthkyg;AccountKey=XXX;BlobEndpoint=https://agenticwafartifactsthkyg.blob.core.windows.net/"
```

### Worker Container (.env for worker)

The worker needs these variables:

```bash
# Required for artifact upload
ARTIFACTS_STORAGE_CONNECTION="your-connection-string"
# OR
ARTIFACTS_STORAGE_SAS="your-sas-token"
STORAGE_ACCOUNT_NAME=agenticwafartifactsthkyg

# Container name (default: final-artifacts)
ARTIFACTS_CONTAINER=final-artifacts
```

### Web App Environment Variables

Set in Azure Portal or via CLI:

```bash
WEBAPP_NAME="agenticwaf-webapp"
RESOURCE_GROUP="rg-kapodeistria-3079"

# Set connection string (easier)
az webapp config appsettings set \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    AZURE_STORAGE_CONNECTION_STRING="your-connection-string-here"

# OR set SAS token
az webapp config appsettings set \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    ARTIFACTS_STORAGE_SAS="your-sas-token-here" \
    STORAGE_ACCOUNT_NAME="agenticwafartifactsthkyg"
```

### Container App Environment Variables

Set in Azure Portal or update via CLI:

```bash
CONTAINERAPP_NAME="agenticwaf-worker"
RESOURCE_GROUP="rg-kapodeistria-3079"

az containerapp update \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    ARTIFACTS_STORAGE_CONNECTION=secretref:storage-connection-string

# First create the secret
az containerapp secret set \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --secrets storage-connection-string="your-connection-string-here"
```

## Quick Setup Script

Save this as `scripts/setup-storage-env.sh`:

```bash
#!/usr/bin/env bash
set -e

STORAGE_ACCOUNT="agenticwafartifactsthkyg"
RESOURCE_GROUP="rg-kapodeistria-3079"

echo "🔑 Fetching Azure Storage credentials..."

CONNECTION_STRING=$(az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString \
  -o tsv)

echo ""
echo "✅ Connection String retrieved!"
echo ""
echo "Add this to your .env.local file:"
echo ""
echo "ARTIFACTS_STORAGE_CONNECTION=\"$CONNECTION_STRING\""
echo ""
echo "Or copy to clipboard:"
echo "echo 'ARTIFACTS_STORAGE_CONNECTION=\"$CONNECTION_STRING\"' | pbcopy"
```

## Verification

Test that storage is working:

```bash
# Test upload (requires az cli + authentication)
echo "test" > test.txt
az storage blob upload \
  --account-name agenticwafartifactsthkyg \
  --container-name final-artifacts \
  --name test.txt \
  --file test.txt \
  --auth-mode login

# Test download (verify public access)
curl https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts/test.txt
```

## Troubleshooting

### "Authorization permission mismatch" Error

Your SAS token doesn't have the right permissions. Regenerate with `--permissions acdlrw`.

### "Container does not exist" Error

Create the container:

```bash
az storage container create \
  --name final-artifacts \
  --account-name agenticwafartifactsthkyg \
  --public-access blob \
  --auth-mode login
```

### Blobs not publicly accessible

Ensure container public access is set to "blob":

```bash
az storage container set-permission \
  --name final-artifacts \
  --account-name agenticwafartifactsthkyg \
  --public-access blob \
  --auth-mode login
```

## Security Best Practices

1. **Use SAS tokens** (not connection strings) in production
2. **Set expiration dates** on SAS tokens (max 1 year)
3. **Use Managed Identity** where possible (Container Apps support this)
4. **Rotate keys regularly** (update connection strings after rotation)
5. **Use Azure Key Vault** for production secrets

## See Also

- [Azure Blob Storage SAS documentation](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Full environment variable reference
