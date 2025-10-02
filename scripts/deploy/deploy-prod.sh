#!/usr/bin/env bash
set -euo pipefail

# Defaults
RESOURCE_GROUP=${AZURE_RESOURCE_GROUP:-rg-kapodeistria-3079}
WEBAPP_NAME=${AZURE_WEBAPP_NAME:-agenticwaf-webapp}
CONTAINERAPP_NAME=${AZURE_CONTAINERAPP_NAME:-agenticwaf-worker}
CONTAINER_ENVIRONMENT=${AZURE_CONTAINER_ENVIRONMENT:-agenticwaf-cae}
ACR_NAME=${AZURE_CONTAINER_REGISTRY:-agenticwafacr}
IMAGE_NAME=${ACR_IMAGE_NAME:-agenticwafworker}
IMAGE_TAG=${ACR_IMAGE_TAG:-v$(date +%Y%m%d%H%M%S)}
IMAGE_FQDN="$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"

info()  { echo -e "\033[1;34m▶ $*\033[0m"; }
success(){ echo -e "\033[1;32m✓ $*\033[0m"; }
warn()  { echo -e "\033[1;33m⚠ $*\033[0m"; }
fail()  { echo -e "\033[1;31m✗ $*\033[0m"; exit 1; }

show_spinner() {
  local pid=$1
  local message=$2
  local i=0
  local sp='|/-\'

  printf "  %s ${sp:0:1}" "$message"
  while kill -0 "$pid" 2>/dev/null; do
    printf "\b${sp:i++%${#sp}:1}"
    sleep 0.2
  done
  printf "\b"
}

run_with_spinner() {
  local msg="$1"
  shift

  "$@" &
  local cmd_pid=$!
  if [[ -z "${cmd_pid:-}" ]]; then
    fail "Failed to start command: $*"
  fi

  trap 'kill "$cmd_pid" 2>/dev/null' INT
  show_spinner "$cmd_pid" "$msg"
  wait "$cmd_pid"
  local exit_code=$?
  trap - INT
  printf "\n"
  return $exit_code
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

info "Deploying Azure Well-Architected platform"
info "Resource group: $RESOURCE_GROUP"
info "Web App:       $WEBAPP_NAME"
info "Container App: $CONTAINERAPP_NAME"
info "ACR image:     $IMAGE_FQDN"
LAST_TIME_FILE="$REPO_ROOT/scripts/deploy/.last_deploy_time"
if [[ -f "$LAST_TIME_FILE" ]]; then
  LAST_TIME=$(cat "$LAST_TIME_FILE" 2>/dev/null || echo "")
  if [[ "$LAST_TIME" =~ ^[0-9]+$ ]]; then
    warn "Last deploy duration: ${LAST_TIME}s"
  fi
fi
start_time=$(date +%s)

if ! command -v az >/dev/null 2>&1; then
  fail "Azure CLI (az) is required."
fi

info "Building container image via Azure Container Registry"
acr_start=$(date +%s)
run_with_spinner "ACR build" az acr build \
  --registry "$ACR_NAME" \
  --image "$IMAGE_NAME:$IMAGE_TAG" \
  --file worker/Dockerfile \
  . >/dev/null || fail "ACR build failed"
acr_end=$(date +%s)

success "Image pushed: $IMAGE_FQDN (build $(($acr_end - $acr_start))s)"

info "Deploying Container App and Web App in parallel..."
parallel_start=$(date +%s)

# Deploy Container App in background
(
  cca_start=$(date +%s)
  previous_revision=$(az containerapp show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINERAPP_NAME" \
    --query properties.latestRevisionName -o tsv 2>/dev/null || echo "")

  revision_suffix="cli-$(date +%Y%m%d%H%M%S)"
  echo "• Triggering Container App update (revision suffix: $revision_suffix)"

  if az containerapp update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$CONTAINERAPP_NAME" \
      --image "$IMAGE_FQDN" \
      --revision-suffix "$revision_suffix" \
      --no-wait >/dev/null 2>&1; then
    echo "  Update submitted, waiting for revision to become ready..."
  else
    echo "✗ Container App update command failed"
    exit 1
  fi

  deadline=$((cca_start + 900))
  new_revision=""

  while [ $(date +%s) -lt $deadline ]; do
    new_revision=$(az containerapp show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$CONTAINERAPP_NAME" \
      --query properties.latestRevisionName -o tsv 2>/dev/null || echo "")

    if [[ -z "$new_revision" || "$new_revision" == "$previous_revision" ]]; then
      sleep 5
      continue
    fi

    state_tuple=$(az containerapp revision show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$CONTAINERAPP_NAME" \
      --revision "$new_revision" \
      --query "join(':', [properties.runningState, properties.provisioningState])" -o tsv 2>/dev/null || echo "")

    running_state=${state_tuple%%:*}
    provisioning_state=${state_tuple#*:}
    if [[ "$state_tuple" != *":"* ]]; then
      provisioning_state=""
    fi

    if [[ "$running_state" == "Running" || "$provisioning_state" == "Succeeded" ]]; then
      echo "✓ Container App revision $new_revision ready ($(( $(date +%s) - cca_start ))s)"
      exit 0
    fi

    echo "  Revision $new_revision status: ${running_state:-${provisioning_state:-pending}}"
    sleep 5
  done

  echo "✗ Timeout waiting for Container App revision to become ready"
  exit 1
) &
container_pid=$!

# Deploy Web App in background
(
  wa_start=$(date +%s)
  cd "$REPO_ROOT/webapp"
  ./redeploy.sh >/dev/null 2>&1
  wa_result=$?
  wa_end=$(date +%s)

  if [ $wa_result -eq 0 ]; then
    echo "✓ Web App redeployed ($(($wa_end - $wa_start))s)"
  else
    echo "✗ Web App deployment failed"
  fi

  exit $wa_result
) &
webapp_pid=$!

# Wait for both and capture exit codes
wait $container_pid
container_exit=$?
wait $webapp_pid
webapp_exit=$?

parallel_end=$(date +%s)

# Check results
if [ $container_exit -ne 0 ]; then
  fail "Container App deployment failed"
fi

if [ $webapp_exit -ne 0 ]; then
  fail "Web App deployment failed"
fi

success "Parallel deployment completed in $(($parallel_end - $parallel_start))s"

info "Checking Container App health"
az containerapp revision list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINERAPP_NAME" \
  --query "[0].name" -o tsv >/dev/null || warn "Unable to query revision name"

total_end=$(date +%s)
duration=$(($total_end - $start_time))
mkdir -p "$(dirname "$LAST_TIME_FILE")"
echo "$duration" > "$LAST_TIME_FILE"
success "Deployment complete in ${duration}s"
info "Container Image: $IMAGE_FQDN"
info "Web App URL: https://$WEBAPP_NAME.azurewebsites.net"
