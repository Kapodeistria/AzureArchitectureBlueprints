#!/bin/bash
set -e

echo "🚀 Deploying to Your Azure AI Foundry Project"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables from .env.local
if [ -f .env.local ]; then
    echo -e "${BLUE}📋 Loading configuration from .env.local...${NC}"
    export $(grep -v '^#' .env.local | xargs)
else
    echo -e "${RED}❌ .env.local file not found!${NC}"
    exit 1
fi

# Extract configuration from environment variables
PROJECT_NAME=$(echo $PROJECT_ENDPOINT | sed 's/.*projects\///g')
RESOURCE_NAME=$(echo $AZURE_OPENAI_ENDPOINT | sed 's/https:\/\///g' | sed 's/\.cognitiveservices\.azure\.com//g')
# Use the actual resource group from Azure
RESOURCE_GROUP=$(az group list --query "[?contains(name, 'kapodeistria')].name" -o tsv | head -1)
if [ -z "$RESOURCE_GROUP" ]; then
    RESOURCE_GROUP="${RESOURCE_NAME}"
fi
LOCATION="eastus" # Default location, can be overridden

echo -e "${BLUE}📋 Extracted Configuration:${NC}"
echo "  Project Name: $PROJECT_NAME"
echo "  Resource Name: $RESOURCE_NAME"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Model Deployment: $MODEL_DEPLOYMENT_NAME"
echo "  API Version: $API_VERSION"
echo "  Location: $LOCATION"
echo ""

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is required but not installed.${NC}"
        exit 1
    fi
}

# Function to deploy promptflow to existing project
deploy_agent_flow() {
    local agent_name=$1
    
    echo -e "${YELLOW}📦 Deploying $agent_name flow...${NC}"
    
    # Create the flow directory
    mkdir -p "flows/${agent_name}"
    
    # Create flow.dag.yaml for this agent
    cat > "flows/${agent_name}/flow.dag.yaml" << EOF
inputs:
  case_study:
    type: string
    description: The case study text to analyze
    default: ""
outputs:
  analysis:
    type: string
    reference: \${llm_node.output}
nodes:
- name: llm_node
  type: llm
  source:
    type: code
    path: ${agent_name}_prompt.jinja2
  inputs:
    deployment_name: ${MODEL_DEPLOYMENT_NAME}
    temperature: 0.3
    max_tokens: 2000
    case_study: \${inputs.case_study}
  connection: azureml:Default_AzureOpenAI
  api: chat
EOF

    # Create the prompt template based on agent type
    case $agent_name in
        "requirements-analyst")
            cat > "flows/${agent_name}/${agent_name}_prompt.jinja2" << 'EOF'
system:
You are a Requirements Analyst Agent specialized in extracting and categorizing requirements from case studies.

Return your response in this exact format:

FUNCTIONAL REQUIREMENTS:
- [requirement 1]
- [requirement 2]
...

NON-FUNCTIONAL REQUIREMENTS:
- [requirement 1] 
- [requirement 2]
...

CONSTRAINTS:
- [constraint 1]
- [constraint 2]
...

Be thorough and specific. Consider implicit requirements based on context.

user:
{{case_study}}
EOF
            ;;
        "azure-services-research")
            cat > "flows/${agent_name}/${agent_name}_prompt.jinja2" << 'EOF'
system:
You are an Azure services research specialist. Research and provide comprehensive information about Azure services relevant to the given requirements.

Focus on:
- Latest Azure services and capabilities (2024-2025)
- Current pricing models and cost optimization opportunities  
- Service limits, quotas, and scaling characteristics
- Integration capabilities and dependencies
- Regional availability considerations

user:
Analyze this case study and recommend relevant Azure services:

{{case_study}}

Provide a detailed analysis of recommended Azure services with justification for each.
EOF
            ;;
        "architecture-designer")
            cat > "flows/${agent_name}/${agent_name}_prompt.jinja2" << 'EOF'
system:
You are a Senior Azure Solution Architect with deep expertise in enterprise cloud architecture.

AZURE SERVICES MASTERY:
COMPUTE: Azure Kubernetes Service (AKS), App Service, Container Apps, Azure Functions, Azure Batch, Service Fabric, Virtual Machines
DATA: Cosmos DB, Azure SQL Database, PostgreSQL, MySQL, Synapse Analytics, Data Factory, Data Lake Storage, Azure Cache for Redis
AI/ML: Azure OpenAI Service, Azure AI Search, Document Intelligence, Machine Learning Studio, AI Studio, Form Recognizer
INTEGRATION: Service Bus, Event Grid, Logic Apps, API Management, Event Hubs, Data Factory pipelines
SECURITY: Azure Entra ID, Key Vault, Defender for Cloud, Private Link, Application Gateway, Web Application Firewall
NETWORKING: Virtual Network, Azure Front Door, Load Balancer, Traffic Manager, ExpressRoute, VPN Gateway
MONITORING: Azure Monitor, Log Analytics, Application Insights, Microsoft Sentinel

ARCHITECTURE PATTERNS:
- Microservices with AKS
- Serverless with Functions and Logic Apps  
- Event-driven with Service Bus/Event Grid
- API-first with API Management
- Data mesh with Synapse and Data Factory
- Zero-trust security model

DESIGN APPROACH:
1. Analyze requirements and constraints
2. Design 3 distinct solutions:
   - COST-OPTIMIZED: Minimize monthly spend while meeting requirements
   - PERFORMANCE-OPTIMIZED: Maximum scalability and performance
   - SECURITY-HARDENED: Enterprise security and compliance focus

FOR EACH SOLUTION:
- Specific Azure services with SKU recommendations
- Architecture patterns and design decisions
- Estimated monthly costs (realistic pricing)
- Pros and cons with business impact
- Scalability and performance characteristics

OUTPUT: Enterprise-grade architecture options with detailed technical justification.

user:
Based on this case study, design 3 comprehensive Azure architecture solutions:

{{case_study}}
EOF
            ;;
        "cost-optimizer")
            cat > "flows/${agent_name}/${agent_name}_prompt.jinja2" << 'EOF'
system:
You are an Azure Cost Optimization specialist focused on enterprise Total Cost of Ownership (TCO) analysis.

COST OPTIMIZATION EXPERTISE:
- Azure pricing models and service tiers
- Reserved Instances and Savings Plans (up to 72% savings)
- Spot instances and low-priority workloads
- Auto-scaling and resource optimization
- Storage tiering and lifecycle management
- Network optimization and data transfer costs

ANALYSIS FRAMEWORK:
1. Current state cost assessment
2. Optimized architecture recommendations
3. Cost comparison with justification
4. Implementation roadmap with ROI timeline

user:
Optimize the costs for this architecture solution:

{{case_study}}

Provide detailed cost optimization recommendations with specific savings estimates.
EOF
            ;;
        *)
            # Generic template for other agents
            cat > "flows/${agent_name}/${agent_name}_prompt.jinja2" << 'EOF'
system:
You are an expert assistant specialized in analyzing case studies and providing detailed insights.

user:
Analyze this case study:

{{case_study}}
EOF
            ;;
    esac
    
    echo -e "${GREEN}  ✅ $agent_name flow created${NC}"
}

# Function to create the main workflow
create_main_workflow() {
    echo -e "${YELLOW}🎼 Creating main interview workflow...${NC}"
    
    mkdir -p "flows/interview-workflow"
    
    # Create the main workflow that orchestrates all agents
    cat > "flows/interview-workflow/flow.dag.yaml" << EOF
inputs:
  case_study:
    type: string
    description: The case study text to analyze
outputs:
  final_analysis:
    type: string
    reference: \${synthesis.output}
  performance_metrics:
    type: object
    reference: \${performance_tracker.output}

nodes:
# Research Phase (Parallel execution)
- name: requirements_analysis
  type: llm
  source:
    type: code
    path: requirements_prompt.jinja2
  inputs:
    deployment_name: ${MODEL_DEPLOYMENT_NAME}
    temperature: 0.1
    max_tokens: 1500
    case_study: \${inputs.case_study}
  connection: azureml:Default_AzureOpenAI
  api: chat

- name: azure_services_research
  type: llm
  source:
    type: code
    path: azure_services_prompt.jinja2
  inputs:
    deployment_name: ${MODEL_DEPLOYMENT_NAME}
    temperature: 0.2
    max_tokens: 2000
    case_study: \${inputs.case_study}
  connection: azureml:Default_AzureOpenAI
  api: chat

# Architecture Design Phase
- name: architecture_design
  type: llm
  source:
    type: code
    path: architecture_prompt.jinja2
  inputs:
    deployment_name: ${MODEL_DEPLOYMENT_NAME}
    temperature: 0.4
    max_tokens: 3000
    case_study: \${inputs.case_study}
    requirements: \${requirements_analysis.output}
    azure_services: \${azure_services_research.output}
  connection: azureml:Default_AzureOpenAI
  api: chat

# Cost Optimization
- name: cost_optimization
  type: llm
  source:
    type: code
    path: cost_optimizer_prompt.jinja2
  inputs:
    deployment_name: ${MODEL_DEPLOYMENT_NAME}
    temperature: 0.3
    max_tokens: 2000
    architecture: \${architecture_design.output}
  connection: azureml:Default_AzureOpenAI
  api: chat

# Final synthesis
- name: synthesis
  type: python
  source:
    type: code
    path: synthesis.py
  inputs:
    case_study: \${inputs.case_study}
    requirements: \${requirements_analysis.output}
    architecture: \${architecture_design.output}
    cost_analysis: \${cost_optimization.output}

# Performance tracking
- name: performance_tracker
  type: python
  source:
    type: code
    path: performance.py
  inputs:
    start_time: \${flow.start_time}
EOF

    # Copy the prompt templates from individual agents (if they exist)
    [ -f "flows/requirements-analyst/requirements-analyst_prompt.jinja2" ] && cp "flows/requirements-analyst/requirements-analyst_prompt.jinja2" "flows/interview-workflow/requirements_prompt.jinja2"
    [ -f "flows/azure-services-research/azure-services-research_prompt.jinja2" ] && cp "flows/azure-services-research/azure-services-research_prompt.jinja2" "flows/interview-workflow/azure_services_prompt.jinja2"
    [ -f "flows/architecture-designer/architecture-designer_prompt.jinja2" ] && cp "flows/architecture-designer/architecture-designer_prompt.jinja2" "flows/interview-workflow/architecture_prompt.jinja2"
    [ -f "flows/cost-optimizer/cost-optimizer_prompt.jinja2" ] && cp "flows/cost-optimizer/cost-optimizer_prompt.jinja2" "flows/interview-workflow/cost_optimizer_prompt.jinja2"

    # Create Python synthesis script
    cat > "flows/interview-workflow/synthesis.py" << 'EOF'
from promptflow import tool
import json
from datetime import datetime

@tool
def synthesize_analysis(case_study: str, requirements: str, architecture: str, cost_analysis: str) -> str:
    """Synthesize all analysis results into final report"""
    
    timestamp = datetime.now().isoformat()
    
    report = f"""# Architecture Solution Analysis
Generated: {timestamp}

## Case Study
{case_study[:500]}...

## Requirements Analysis
{requirements}

## Architecture Design
{architecture}

## Cost Analysis
{cost_analysis}

## Summary
This analysis provides a comprehensive Azure solution for the given case study, 
including detailed requirements analysis, architecture design, and cost optimization.

---
*Generated by Azure AI Foundry Interview Assistant*
"""
    
    return report
EOF

    # Create Python performance tracking script
    cat > "flows/interview-workflow/performance.py" << 'EOF'
from promptflow import tool
import time
import json

@tool
def track_performance(start_time: float) -> dict:
    """Track workflow performance metrics"""
    
    end_time = time.time()
    total_time = end_time - start_time
    
    metrics = {
        "total_execution_time_ms": int(total_time * 1000),
        "start_time": start_time,
        "end_time": end_time,
        "status": "completed",
        "workflow_version": "v1.0"
    }
    
    return metrics
EOF

    echo -e "${GREEN}  ✅ Main workflow created${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check required tools
    check_command "az"
    
    # Login check
    if ! az account show &> /dev/null; then
        echo -e "${RED}❌ Please run 'az login' first${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites OK${NC}"
    echo ""
    
    # Verify we can access the resource group
    echo -e "${YELLOW}🔍 Verifying access to resource group...${NC}"
    if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        echo -e "${RED}❌ Cannot access resource group '$RESOURCE_GROUP'${NC}"
        echo -e "${YELLOW}💡 Available resource groups:${NC}"
        az group list --query "[].name" -o table
        exit 1
    fi
    
    echo -e "${GREEN}✅ Resource group '$RESOURCE_GROUP' accessible${NC}"
    echo ""
    
    # Create flows directory
    echo -e "${YELLOW}📁 Creating flow structures...${NC}"
    mkdir -p flows
    
    # Deploy individual agent flows
    agents=(
        "requirements-analyst"
        "azure-services-research" 
        "architecture-designer"
        "cost-optimizer"
    )
    
    for agent in "\${agents[@]}"; do
        deploy_agent_flow "$agent"
    done
    
    # Create main workflow
    create_main_workflow
    
    echo ""
    echo -e "${GREEN}🎉 Flow Deployment Complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 What was created:${NC}"
    echo "  ✅ 4 specialized agent flows"
    echo "  ✅ Main orchestration workflow"
    echo "  ✅ Python synthesis and performance tracking"
    echo "  ✅ Ready for deployment to your Azure AI Foundry project"
    echo ""
    echo -e "${BLUE}🚀 Deploy to Azure AI Foundry:${NC}"
    echo "  cd flows/interview-workflow"
    echo "  az ml flow create --file flow.dag.yaml --resource-group $RESOURCE_GROUP"
    echo ""
    echo -e "${BLUE}🧪 Test the workflow:${NC}"
    echo "  az ml flow test --file flow.dag.yaml --inputs case_study='Your case study text here'"
    echo ""
    echo -e "${YELLOW}💡 Your project details:${NC}"
    echo "  • Project: $PROJECT_NAME"
    echo "  • Resource Group: $RESOURCE_GROUP"
    echo "  • Model Deployment: $MODEL_DEPLOYMENT_NAME"
    echo "  • Endpoint: $PROJECT_ENDPOINT"
}

# Error handling
trap 'echo -e "\${RED}❌ Deployment failed. Check the error above.\${NC}"; exit 1' ERR

# Run main function
main

echo -e "\${GREEN}🚀 Your Azure AI Foundry flows are ready for deployment!\${NC}"