#!/bin/bash

# Azure AI Foundry Agent Redeployment Script
# Deletes all existing agents and redeploys them fresh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Azure AI Foundry Agent Redeployment${NC}"
echo "This will delete all existing agents and create fresh ones"
echo ""

# Confirm redeployment
echo -e "${YELLOW}⚠️  WARNING: This will DELETE ALL existing agents and recreate them!${NC}"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚫 Redeployment cancelled${NC}"
    exit 0
fi

echo -e "${RED}🗑️  Step 1: Deleting existing agents...${NC}"

# Run delete script with force flag to skip confirmation
./delete-agents.sh --force || {
    echo -e "${YELLOW}⚠️  Delete step completed (some agents may not have existed)${NC}"
}

echo ""
echo -e "${GREEN}🚀 Step 2: Deploying fresh agents...${NC}"
./deploy-agents.sh

echo ""
echo -e "${GREEN}🎉 Redeployment completed successfully!${NC}"
echo -e "${BLUE}🔗 Check your agents at: https://ai.azure.com${NC}"