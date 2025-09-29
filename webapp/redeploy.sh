#!/bin/bash
set -e
COMMAND="${1:-deploy}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-agentic-waf}"
WEBAPP_NAME="${AZURE_WEBAPP_NAME:-agenticwaf-webapp}"

print_step() { echo -e "${BLUE}▶ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

show_logs() { az webapp log tail -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME"; }
show_status() {
    print_step "Status"
    az webapp show -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME" --query "{state:state,availabilityState:availabilityState}" -o json | jq -r 'to_entries|.[]|"  \(.key): \(.value)"'
    echo ""
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${WEBAPP_NAME}.azurewebsites.net/api/health" --max-time 5)
    [ "$HTTP" = "200" ] && print_success "Health: OK ($HTTP)" || print_error "Health: FAILED ($HTTP)"
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

print_step "1. Cleaning"; rm -f deploy.zip; print_success "Done"
print_step "2. Installing"; npm install --production --silent; print_success "Done"
print_step "3. Packaging"; zip -qr deploy.zip src/ public/ node_modules/ package*.json *.md; print_success "Done ($(du -h deploy.zip|cut -f1))"
print_step "4. Deploying"; 
az webapp deploy -g "$RESOURCE_GROUP" -n "$WEBAPP_NAME" --src-path deploy.zip --type zip --async true 2>&1 | grep Status | tail -2 || true
print_success "Deployed"
print_step "5. Waiting 30s"; sleep 30
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://${WEBAPP_NAME}.azurewebsites.net/api/health" --max-time 10)
[ "$HTTP" = "200" ] && print_success "Health: OK" || print_warning "Health: $HTTP"
rm -f deploy.zip

echo -e "\n${GREEN}✓ Complete!${NC}"
echo -e "URL: https://${WEBAPP_NAME}.azurewebsites.net\n"
