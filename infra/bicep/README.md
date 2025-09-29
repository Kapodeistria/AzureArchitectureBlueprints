# Production-Ready Infrastructure Deployment

This directory contains an enterprise-grade infrastructure-as-code stack for the Agentic Well-Architected Framework system. It provisions Azure resources optimized for 20-agent parallel processing with GPT-4o.

## Resources deployed
- **Azure Storage (ZRS + Static Website)** – Zone-redundant storage hosting generated artifacts with enhanced security (Azure AD auth, TLS 1.2+)
- **Azure Machine Learning workspace** – Azure AI Foundry runtime for agent orchestration and deployment
- **Azure OpenAI (GPT-4o + 240 TPM capacity)** – Production-grade model deployment supporting 20 concurrent agents

## Prerequisites
- Azure CLI `>= 2.61`
- Logged in via `az login`
- Access to an Azure subscription with Azure OpenAI enabled in the selected region (e.g. `swedencentral`, `eastus`).

## Deploy the stack
1. Create (or reuse) a resource group:
   ```bash
   az group create --name agentic-poc-rg --location westeurope
   ```
2. Deploy the Bicep template:
   ```bash
   az deployment group create \
     --resource-group agentic-poc-rg \
     --template-file infra/bicep/main.bicep \
     --parameters @infra/bicep/main.parameters.json
   ```

The command prints the output values, including:
- `staticWebsiteUrl` – public endpoint that lists published case study files.
- `artifactContainerUrl` – blob endpoint for programmatic uploads.
- `mlStudioUrl` – quick link to the Azure ML studio bound to the workspace.
- `openAiEndpoint` + `openAiDeploymentName` – feed these into your `.env` for agent configuration.

## Key Improvements Over Original PoC

### Performance & Capacity
- **Model**: Upgraded from `gpt-4o-mini` → **`gpt-4o`** (production-grade quality)
- **Capacity**: Increased from 60 TPM → **240 TPM** (supports 20 agents + 2500 tokens each)
- **API Version**: Updated to `2024-04-01-preview` (latest features)

### Reliability & Security
- **Storage Redundancy**: Upgraded from LRS → **ZRS** (zone-redundant storage)
- **Authentication**: Enforces **Azure AD** auth (disabled shared keys)
- **TLS**: Minimum **TLS 1.2** enforced
- **API Versions**: All modules updated to latest stable versions

## Customization
Edit `infra/bicep/main.parameters.json` to:
- Change `environmentName` (affects resource names)
- Select different regions (default: `westeurope` + `swedencentral` for OpenAI)
- Adjust `deploymentCapacity` if you need more/less throughput

## Production Hardening (Next Steps)
For enterprise production, consider adding:
- **Key Vault** for secrets management (API keys, connection strings)
- **Application Insights** for monitoring and diagnostics
- **Private Endpoints** for network isolation
- **Managed Identities** with RBAC assignments
- **Azure Policy** enforcement and compliance scanning
- **Customer-Managed Keys** for encryption
