#!/bin/bash
set -e
COMMAND="${1:-deploy}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-kapodeistria-3079}"
WEBAPP_NAME="${AZURE_WEBAPP_NAME:-agenticwaf-webapp}"

print_step() { echo -e "${BLUE}▶ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

get_live_version() {
    curl -s "https://${WEBAPP_NAME}.azurewebsites.net/api/version" --max-time 5 | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "unknown"
}

get_local_version() {
    grep '"version"' package.json | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || echo "unknown"
}

show_logs() { az webapp log tail -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME"; }
show_status() {
    print_step "Status"
    az webapp show -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME" --query "{state:state,availabilityState:availabilityState}" -o json | jq -r 'to_entries|.[]|"  \(.key): \(.value)"'
    echo ""
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${WEBAPP_NAME}.azurewebsites.net/api/health" --max-time 5)
    [ "$HTTP" = "200" ] && print_success "Health: OK ($HTTP)" || print_error "Health: FAILED ($HTTP)"
    LIVE_VER=$(get_live_version)
    echo -e "  Live version: ${LIVE_VER}"
}
restart_app() { az webapp restart -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME" && print_success "Restarted"; }
show_help() { echo "Usage: ./redeploy.sh [deploy|logs|status|restart|help]"; }

case "$COMMAND" in
    logs) show_logs; exit 0 ;;
    status) show_status; exit 0 ;;
    restart) restart_app; exit 0 ;;
    help|--help|-h) show_help; exit 0 ;;
    deploy) ;;
    *) print_error "Unknown: $COMMAND"; show_help; exit 1 ;;
esac

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   Agentic WAF - Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

LIVE_VERSION=$(get_live_version)
LOCAL_VERSION=$(get_local_version)

echo -e "Live version:  ${YELLOW}${LIVE_VERSION}${NC}"
echo -e "Local version: ${YELLOW}${LOCAL_VERSION}${NC}"

# Version check disabled to allow redeployments
# if [ "$LIVE_VERSION" = "$LOCAL_VERSION" ] && [ "$LIVE_VERSION" != "unknown" ]; then
#     print_error "Version $LOCAL_VERSION is already deployed!"
#     echo -e "${YELLOW}Bump the version first:${NC} npm version patch --no-git-tag-version"
#     exit 1
# fi

print_step "1. Cleaning"; rm -f deploy.zip; print_success "Done"
print_step "2. Installing"; npm install --production --silent; print_success "Done"
pkg_start=$(date +%s)
print_step "3. Packaging"; zip -qr deploy.zip src/ public/ node_modules/ package*.json *.md; pkg_end=$(date +%s); print_success "Done ($(du -h deploy.zip|cut -f1), $((pkg_end - pkg_start))s)"
print_step "4. Deploying v${LOCAL_VERSION}"; dep_start=$(date +%s)
az webapp deploy -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME" --src-path deploy.zip --type zip --async true 2>&1 | grep Status | tail -2 || true
sleep 30
dep_end=$(date +%s)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${WEBAPP_NAME}.azurewebsites.net/api/health" --max-time 10)
[ "$HTTP" = "200" ] && print_success "Deployed (publish $((dep_end - dep_start))s, health OK)" || print_warning "Deploy finished, health check: $HTTP"

print_step "5. Verifying version"
NEW_VERSION=$(get_live_version)
if [ "$NEW_VERSION" = "$LOCAL_VERSION" ]; then
    print_success "Version confirmed: ${NEW_VERSION}"
else
    print_warning "Version mismatch: live=${NEW_VERSION}, expected=${LOCAL_VERSION}"
    print_warning "Try hard-refreshing (Cmd+Shift+R) or wait 30s for CDN"
fi

rm -f deploy.zip

echo -e "\n${GREEN}✓ Complete!${NC}"
echo -e "URL: https://${WEBAPP_NAME}.azurewebsites.net"
echo -e "Version: ${NEW_VERSION}\n"
