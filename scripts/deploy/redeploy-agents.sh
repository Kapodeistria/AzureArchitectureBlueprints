#!/bin/bash

# Azure AI Foundry Agent Redeployment Script
# Deletes all existing agents and redeploys them with fresh IDs using registry system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Azure AI Foundry Agent Redeployment with Registry${NC}"
echo "This will delete all existing agents and create fresh ones with new IDs"
echo ""

# Check if --force flag is provided
FORCE_FLAG=false
if [[ "$1" == "--force" ]]; then
    FORCE_FLAG=true
fi

# Confirm redeployment unless forced
if [[ "$FORCE_FLAG" != "true" ]]; then
    echo -e "${YELLOW}⚠️  WARNING: This will DELETE ALL existing agents and recreate them!${NC}"
    echo -e "${YELLOW}This will also update the agent registry with new IDs.${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🚫 Redeployment cancelled${NC}"
        exit 0
    fi
fi

echo -e "${RED}🗑️  Step 1: Deleting existing agents and clearing registry...${NC}"

# Use our new deployment script with redeploy command
set +e # Don't exit on errors for this step
npx tsx src/utils/deploy-agents-to-foundry.ts redeploy
DEPLOY_RESULT=$?
set -e

if [[ $DEPLOY_RESULT -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 Redeployment completed successfully!${NC}"
    echo -e "${BLUE}📋 Agent registry updated with new IDs${NC}"
    echo ""
    echo -e "${YELLOW}🔧 To use these agents in your shell:${NC}"
    echo "   source foundry-agents/agent-ids.env"
    echo ""
    echo -e "${YELLOW}💡 Or add to your .env.local for permanent use:${NC}"
    echo "   cat foundry-agents/agent-ids.env >> .env.local"
    echo ""
    echo -e "${BLUE}🔗 Check your agents at: https://ai.azure.com${NC}"
else
    echo -e "${RED}❌ Redeployment failed!${NC}"
    echo "Check the logs above for error details."
    exit 1
fi