#!/usr/bin/env bash
set -euo pipefail

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required but was not found on PATH." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <resource-group-name> [parameters-file]" >&2
  echo "Example: $(basename "$0") agentic-poc-rg infra/bicep/main.parameters.json" >&2
  exit 1
fi

RESOURCE_GROUP="$1"
PARAMETERS_FILE="${2:-infra/bicep/main.parameters.json}"
TEMPLATE_FILE="infra/bicep/main.bicep"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ ! -f "$REPO_ROOT/$TEMPLATE_FILE" ]]; then
  echo "Template file $TEMPLATE_FILE not found relative to repo root." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/$PARAMETERS_FILE" ]]; then
  echo "Parameters file $PARAMETERS_FILE not found relative to repo root." >&2
  exit 1
fi

az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$REPO_ROOT/$TEMPLATE_FILE" \
  --parameters @"$REPO_ROOT/$PARAMETERS_FILE"
