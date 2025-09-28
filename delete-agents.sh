#!/bin/bash

# Azure AI Foundry Agent Deletion Script
# Deletes all agents from your Azure AI Foundry project

set -e

# Configuration
PROJECT_ENDPOINT="https://kapodeistria-1337-resource.services.ai.azure.com/api/projects/kapodeistria-1337"
API_VERSION="2025-05-01"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}🗑️  Azure AI Foundry Agent Deletion${NC}"
echo "Project: $PROJECT_ENDPOINT"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI not found. Please install it first:${NC}"
    echo "brew install azure-cli"
    exit 1
fi

# Check if user is logged in
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged into Azure. Logging in...${NC}"
    az login
fi

# Get access token for Azure AI Foundry
echo -e "${BLUE}🔐 Getting access token...${NC}"

AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken --output tsv 2>/dev/null)

if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
    echo -e "${YELLOW}Trying alternative resource scope...${NC}"
    AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken --output tsv 2>/dev/null)
fi

if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Failed to get access token${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Access token obtained${NC}"

# Function to list agents
list_agents() {
    echo -e "${BLUE}📋 Listing existing agents...${NC}"
    
    local response=$(curl -s -w "\n%{http_code}" \
        --request GET \
        --url "${PROJECT_ENDPOINT}/assistants?api-version=${API_VERSION}" \
        --header "authorization: Bearer $AZURE_AI_AUTH_TOKEN")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        # Extract agent data (id and name pairs)
        echo "$body" | jq -r '.data[]? | "\(.id)|\(.name)"' 2>/dev/null || {
            # Fallback for systems without jq
            echo "$body" | grep -o '"id":"[^"]*","[^"]*":"[^"]*","name":"[^"]*"' | sed 's/"id":"\([^"]*\)".*"name":"\([^"]*\)"/\1|\2/g'
        }
    else
        echo -e "${YELLOW}⚠️  Could not list agents (HTTP $http_code)${NC}"
        return 1
    fi
}

# Function to delete an agent
delete_agent() {
    local agent_id=$1
    local agent_name=$2
    
    echo -e "${RED}🗑️  Deleting agent: $agent_name (ID: $agent_id)${NC}"
    
    local response=$(curl -s -w "\n%{http_code}" \
        --request DELETE \
        --url "${PROJECT_ENDPOINT}/assistants/${agent_id}?api-version=${API_VERSION}" \
        --header "authorization: Bearer $AZURE_AI_AUTH_TOKEN")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 204 ]; then
        echo -e "${GREEN}✅ Agent $agent_name deleted successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to delete agent $agent_name (HTTP $http_code)${NC}"
        echo "Response: $body"
        return 1
    fi
}

# Main deletion process
echo -e "${BLUE}🔍 Finding agents to delete...${NC}"

# Get list of agents
agent_data=$(list_agents)

if [ -z "$agent_data" ]; then
    echo -e "${YELLOW}⚠️  No agents found to delete${NC}"
    exit 0
fi

echo -e "${BLUE}📋 Found agents:${NC}"
echo "$agent_data" | while IFS='|' read -r id name; do
    echo "  - $name (ID: $id)"
done

# Confirm deletion (unless --force flag is used)
if [[ "$1" != "--force" ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  WARNING: This will delete ALL agents from your Azure AI Foundry project!${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🚫 Deletion cancelled${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}🤖 Force mode enabled - skipping confirmation${NC}"
fi

echo -e "${RED}🚀 Starting agent deletion...${NC}"

# Delete each agent
echo "$agent_data" | while IFS='|' read -r id name; do
    if [ -n "$id" ] && [ -n "$name" ]; then
        delete_agent "$id" "$name"
        sleep 1  # Rate limiting
    fi
done

echo -e "\n${GREEN}🎉 All agents deleted successfully!${NC}"
echo -e "${BLUE}🔗 Verify at: https://ai.azure.com${NC}"