#!/bin/bash

# Deploy Structurizr DSL Designer Agent to Azure AI Foundry
# Creates professional C4 Model architecture diagrams

echo "🏗️ Deploying Structurizr DSL Designer Agent..."

# Load configuration
source "$(dirname "$0")/../config-cli.ts"

# Agent configuration
AGENT_NAME="structurizr-dsl-designer"
AGENT_CONFIG="foundry-agents/structurizr-dsl-designer.json"

# Validate configuration file exists
if [ ! -f "$AGENT_CONFIG" ]; then
    echo "❌ Error: Configuration file not found: $AGENT_CONFIG"
    exit 1
fi

# Create the agent using Azure ML CLI
echo "📦 Creating agent: $AGENT_NAME"

az ml flow create \
    --file "$AGENT_CONFIG" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --workspace-name "$AZURE_ML_WORKSPACE" \
    --name "$AGENT_NAME" \
    --description "C4 Model Structurizr DSL Generator for Architecture Visualization" \
    --tags "agent=structurizr-dsl,type=architecture,output=diagram-dsl"

if [ $? -eq 0 ]; then
    echo "✅ Structurizr DSL Designer Agent deployed successfully!"
    echo "🔗 Agent ID: $AGENT_NAME"
    echo "📊 Capabilities: C4 Model diagrams, Structurizr DSL, Architecture visualization"
    echo "🎯 Use cases: System landscapes, Container diagrams, Component diagrams"
else
    echo "❌ Failed to deploy Structurizr DSL Designer Agent"
    exit 1
fi

# Test the agent
echo "🧪 Testing agent deployment..."

az ml flow test \
    --name "$AGENT_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --workspace-name "$AZURE_ML_WORKSPACE" \
    --test-data '{"architecture": {"type": "microservices", "components": [{"name": "API Gateway", "type": "container"}, {"name": "User Service", "type": "service"}]}, "requirements": "Generate a container diagram for microservices architecture", "level": "container"}'

echo "🎉 Structurizr DSL Designer Agent ready for architecture visualization!"