#!/bin/bash

# Azure AI Foundry Agent Deployment Script
# Deploys agents to your Azure AI Foundry project via CLI
#
# Authentication options (in order of preference):
# 1. FOUNDRY_API_KEY environment variable
# 2. FOUNDRY_API_KEY in .env.local file  
# 3. Azure CLI (az login) - fallback method
#
# Usage:
#   export FOUNDRY_API_KEY="your-api-key"
#   ./deploy-agents.sh
#
# Or create .env.local file with:
#   FOUNDRY_API_KEY=your-api-key

set -e

# Configuration
PROJECT_ENDPOINT="https://kapodeistria-1337-resource.services.ai.azure.com/api/projects/kapodeistria-1337"
MODEL_DEPLOYMENT_NAME="gpt-4.1"
API_VERSION="2025-05-01"

# Colors for output (VS Code terminal compatible)
if [ "$TERM_PROGRAM" = "vscode" ]; then
    # VS Code terminal colors
    RED='\033[31m'
    GREEN='\033[32m'
    YELLOW='\033[33m'
    BLUE='\033[34m'
    CYAN='\033[36m'
    NC='\033[0m'
else
    # Standard terminal colors
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
fi

echo -e "${BLUE}🚀 Azure AI Foundry Agent Deployment${NC}"
echo "Project: $PROJECT_ENDPOINT"
echo "Model: $MODEL_DEPLOYMENT_NAME"
echo ""

# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    echo -e "${BLUE}📄 Loading environment from .env.local...${NC}"
    # Source the file in a subshell to avoid polluting current environment
    set -a
    source .env.local
    set +a
fi

# Function to setup authentication headers
setup_auth() {
    # Try API key first (from environment or .env.local)
    if [ -n "$FOUNDRY_API_KEY" ]; then
        echo -e "${GREEN}🔑 Using API key authentication${NC}"
        AUTH_HEADER="api-key: $FOUNDRY_API_KEY"
        return 0
    fi
    
    # Fallback to Azure CLI authentication
    echo -e "${YELLOW}🔐 API key not found, falling back to Azure CLI authentication...${NC}"
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        echo -e "${RED}❌ Azure CLI not found and no API key provided${NC}"
        echo -e "${YELLOW}💡 Please either:${NC}"
        echo "   1. Set FOUNDRY_API_KEY environment variable"
        echo "   2. Add FOUNDRY_API_KEY to .env.local file"
        echo "   3. Install Azure CLI: brew install azure-cli"
        exit 1
    fi
    
    # Check if user is logged in
    if ! az account show &> /dev/null; then
        echo -e "${YELLOW}⚠️  Not logged into Azure. Logging in...${NC}"
        az login
    fi
    
    # Get access token for Azure AI Foundry (try multiple resource scopes)
    echo -e "${BLUE}🔐 Getting access token...${NC}"
    
    # Try different resource scopes
    AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken --output tsv 2>/dev/null)
    
    if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
        echo -e "${YELLOW}Trying alternative resource scope...${NC}"
        AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken --output tsv 2>/dev/null)
    fi
    
    if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
        echo -e "${YELLOW}Trying management API scope...${NC}"
        AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken --output tsv 2>/dev/null)
    fi
    
    if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
        echo -e "${RED}❌ Failed to get access token${NC}"
        echo -e "${YELLOW}💡 Please check your Azure CLI login or use FOUNDRY_API_KEY instead${NC}"
        exit 1
    fi
    
    AUTH_HEADER="authorization: Bearer $AZURE_AI_AUTH_TOKEN"
    echo -e "${GREEN}✅ Access token obtained${NC}"
    return 0
}

# Setup authentication
setup_auth

# Agent configurations (using arrays for macOS compatibility)
AGENT_NAMES=("waf-security-agent" "waf-reliability-agent" "waf-performance-agent" "waf-operational-agent" "waf-cost-agent" "requirements-analyst" "architecture-designer")
AGENT_INSTRUCTIONS=(
    "Microsoft Well-Architected Framework Security pillar assessment agent specializing in Azure WAF Security checklist items (SE:01 - SE:12). Use the RAG knowledge base to reference official Microsoft WAF Security guidelines during assessments."
    "Microsoft Well-Architected Framework Reliability pillar assessment agent specializing in Azure WAF Reliability checklist items (RE:01 - RE:10). Use the RAG knowledge base to reference official Microsoft WAF Reliability guidelines during assessments."
    "Microsoft Well-Architected Framework Performance Efficiency pillar assessment agent specializing in Azure WAF Performance checklist items (PE:01 - PE:12). Use the RAG knowledge base to reference official Microsoft WAF Performance guidelines during assessments."
    "Microsoft Well-Architected Framework Operational Excellence pillar assessment agent specializing in Azure WAF Operational checklist items (OE:01 - OE:12). Use the RAG knowledge base to reference official Microsoft WAF Operational guidelines during assessments."
    "Microsoft Well-Architected Framework Cost Optimization pillar assessment agent specializing in Azure WAF Cost checklist items (CO:01 - CO:14). Use the RAG knowledge base to reference official Microsoft WAF Cost guidelines during assessments."
    "Analyzes and extracts technical requirements from project specifications and user stories for Azure architecture assessments."
    "Designs comprehensive Azure architecture solutions with deep expertise in enterprise cloud architecture and Well-Architected Framework principles."
)

# Function to create an agent
create_agent() {
    local name=$1
    local instructions=$2
    
    echo -e "${BLUE}📤 Creating agent: ${CYAN}$name${NC}"
    
    local payload
    payload=$(cat <<EOF
{
  "model": "$MODEL_DEPLOYMENT_NAME",
  "name": "$name",
  "instructions": "$instructions",
  "tools": [
    {"type": "code_interpreter"},
    {"type": "file_search"}
  ],
  "temperature": 0.1,
  "top_p": 0.95
}
EOF
)

    local response
    response=$(curl -s -w "\n%{http_code}" \
        --request POST \
        --url "${PROJECT_ENDPOINT}/assistants?api-version=${API_VERSION}" \
        --header "$AUTH_HEADER" \
        --header "content-type: application/json" \
        --data "$payload")
    
    local http_code
    http_code=$(echo "$response" | tail -1)
    local body
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 201 ] || [ "$http_code" -eq 200 ]; then
        # Try multiple methods to extract ID from JSON response
        local agent_id=""
        
        # Method 1: Try with jq if available
        if command -v jq &> /dev/null; then
            agent_id=$(echo "$body" | jq -r '.id // empty' 2>/dev/null)
        fi
        
        # Method 2: Grep fallback with better regex
        if [ -z "$agent_id" ]; then
            agent_id=$(echo "$body" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        fi
        
        # Method 3: Simple grep fallback
        if [ -z "$agent_id" ]; then
            agent_id=$(echo "$body" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        fi
        
        # Display result
        if [ -n "$agent_id" ]; then
            echo -e "${GREEN}✅ Agent ${CYAN}$name${GREEN} created successfully${NC}"
            echo -e "   ${BLUE}ID: ${CYAN}$agent_id${NC}"
        else
            echo -e "${GREEN}✅ Agent ${CYAN}$name${GREEN} created successfully${NC}"
            echo -e "   ${YELLOW}⚠️  Could not extract ID from response${NC}"
            echo -e "   ${BLUE}Debug response: ${body:0:100}...${NC}"
        fi
        return 0
    else
        echo -e "${RED}❌ Failed to create agent ${CYAN}$name${RED} (HTTP $http_code)${NC}"
        echo -e "   ${YELLOW}Response: $body${NC}"
        return 1
    fi
}

# Function to list existing agents
list_agents() {
    echo -e "${BLUE}📋 Listing existing agents...${NC}"
    
    local response
    response=$(curl -s -w "\n%{http_code}" \
        --request GET \
        --url "${PROJECT_ENDPOINT}/assistants?api-version=${API_VERSION}" \
        --header "$AUTH_HEADER")
    
    local http_code
    http_code=$(echo "$response" | tail -1)
    local body
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ]; then
        # Try to extract agent names and IDs
        if command -v jq &> /dev/null; then
            # Use jq for clean JSON parsing
            local agent_count=$(echo "$body" | jq -r '.data | length' 2>/dev/null || echo "0")
            if [ "$agent_count" -gt 0 ]; then
                echo -e "${GREEN}✅ Found $agent_count existing agents:${NC}"
                echo "$body" | jq -r '.data[]? | "  - \(.name) (ID: \(.id))"' 2>/dev/null | while read -r line; do
                    echo -e "${CYAN}$line${NC}"
                done
            else
                echo -e "${YELLOW}📭 No existing agents found${NC}"
            fi
        else
            # Fallback without jq
            local names=$(echo "$body" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
            if [ -n "$names" ]; then
                echo -e "${GREEN}✅ Existing agents:${NC}"
                echo "$names" | sed "s/^/${CYAN}  - /" | sed "s/$/${NC}/"
            else
                echo -e "${YELLOW}📭 No existing agents found${NC}"
            fi
        fi
        return 0
    else
        echo -e "${YELLOW}⚠️  Could not list agents (HTTP $http_code)${NC}"
        echo -e "${BLUE}Debug - Response body:${NC} ${body:0:200}..."
        echo -e "${BLUE}Debug - Full URL:${NC} ${PROJECT_ENDPOINT}/assistants?api-version=${API_VERSION}"
        return 1
    fi
}

# Main deployment process
echo -e "${BLUE}🔍 Checking existing agents...${NC}"
list_agents

echo -e "\n${BLUE}🚀 Starting agent deployment...${NC}"

# Deploy each agent
for i in "${!AGENT_NAMES[@]}"; do
    create_agent "${AGENT_NAMES[$i]}" "${AGENT_INSTRUCTIONS[$i]}"
    sleep 2  # Rate limiting
done

echo -e "\n${GREEN}🎉 Deployment completed!${NC}"
echo -e "${BLUE}📊 Final agent list:${NC}"
list_agents

echo -e "\n${YELLOW}💡 Next steps:${NC}"
echo "1. Test your agents in the Azure AI Foundry portal"
echo "2. Set up agent threads for conversations"
echo "3. Configure webhooks or integrate with your application"
echo ""
echo -e "${BLUE}🔗 Portal URL: https://ai.azure.com${NC}"