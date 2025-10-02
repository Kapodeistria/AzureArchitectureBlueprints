# Hybrid Architecture - Secure Agent Processing

> **Note (2025-10-01)**
> Production processing has moved back to the Container App worker (`agenticwaf-worker`). This document captures the active architecture—Durable Functions has been fully retired.

This document describes the original hybrid architecture that securely separated the web UI from the AI agent processing backend.

## 🎯 Architecture Overview

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────────────────────┐
│  Azure App Service (Web UI)     │
│  - Express.js server            │
│  - Job submission               │
│  - Real-time status via SSE     │
│  - No API keys stored           │
└────────┬────────────────────────┘
         │ Service Bus
         ↓
┌─────────────────────────────────┐
│  Azure Service Bus              │
│  ├─ casestudy-jobs queue        │
│  └─ casestudy-status queue      │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Container App Worker           │
│  - Processes jobs from queue    │
│  - Runs AI agent orchestration  │
│  - Publishes status telemetry   │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Azure AI Foundry Agents        │
│  - Research Orchestrator        │
│  - Architecture Design          │
│  - WAF Security/Reliability     │
│  - Cost Estimation, etc.        │
└─────────────────────────────────┘
```

## 🔐 Security Benefits

1. **No API Keys in Web App**: Webapp doesn't need Azure OpenAI keys
2. **Isolated Processing**: Agent execution happens in separate container
3. **Managed Identity**: Worker uses Azure Managed Identity for auth
4. **Service Bus ACL**: Fine-grained access control on queues
5. **Network Isolation**: Container Apps can use VNet integration
6. **Audit Trail**: All job submissions logged in Service Bus

## 📦 Components

### 1. Web App (App Service)
**Location**: `/webapp`
**Purpose**: Public-facing web interface

**Responsibilities**:
- Accept case study submissions via web form
- Submit jobs to Service Bus queue
- Track job status in-memory
- Provide real-time updates via SSE
- Display results

**Environment Variables**:
```bash
SERVICE_BUS_CONNECTION=<connection-string>
SERVICE_BUS_JOB_QUEUE=casestudy-jobs
SERVICE_BUS_STATUS_QUEUE=casestudy-status
AZURE_OPENAI_ENDPOINT=<endpoint>      # For config display only
AZURE_ML_WORKSPACE_NAME=<workspace>    # For config display only
STORAGE_ACCOUNT_NAME=<storage>         # For results URL
ARTIFACT_CONTAINER_URL=<url>           # For download links
```

### 2. Service Bus
**Purpose**: Message queue for job distribution and status updates

**Queues**:
- `casestudy-jobs`: Job submission queue
  - Lock duration: 5 minutes
  - Max delivery count: 3
  - Dead letter on expiration: Yes

- `casestudy-status`: Status update queue
  - Lock duration: 1 minute
  - Max delivery count: 3
  - Dead letter on expiration: No

**Message Format (Job)**:
```json
{
  "sessionId": "web-1234567890",
  "caseStudyInput": "Build a...",
  "quickMode": true,
  "timestamp": "2025-09-30T12:00:00Z"
}
```

**Message Format (Status)**:
```json
{
  "sessionId": "web-1234567890",
  "status": "running",
  "progress": 45,
  "currentAgent": "architecture-design",
  "completedAgents": ["requirements-analysis"],
  "error": null,
  "result": null,
  "timestamp": "2025-09-30T12:01:00Z"
}
```

### 3. Worker (Container App)
**Location**: `/worker`
**Purpose**: Background job processor

**Responsibilities**:
- Listen to casestudy-jobs queue
- Execute CLI orchestrator for each job
- Send progress updates to status queue
- Handle errors and retries
- Upload results to storage

**Environment Variables**:
```bash
SERVICE_BUS_CONNECTION=<connection-string>
SERVICE_BUS_JOB_QUEUE=casestudy-jobs
SERVICE_BUS_STATUS_QUEUE=casestudy-status
AZURE_OPENAI_ENDPOINT=<endpoint>
AZURE_OPENAI_DEPLOYMENT_NAME=<deployment>
AZURE_ML_WORKSPACE_NAME=<workspace>
STORAGE_ACCOUNT_NAME=<storage>
```

**Scaling**:
- Min replicas: 0 (scale to zero when idle)
- Max replicas: 5
- Scale trigger: Azure Service Bus queue length
- Scale rule: 1 message = 1 replica

## 🚀 Deployment

### Step 1: Deploy Infrastructure

```bash
cd /path/to/interviews

# Deploy all resources (Service Bus, Container App, Web App)
az deployment group create \
  --resource-group rg-kapodeistria-3079 \
  --name agentic-hybrid-deployment \
  --template-file infra/bicep/main.bicep \
  --parameters @infra/bicep/main.parameters.json
```

### Step 2: Build and Push Worker Image

```bash
# Build the worker Docker image
docker build -t agenticwaf-worker:latest -f worker/Dockerfile .

# Tag for Azure Container Registry
docker tag agenticwaf-worker:latest <your-acr>.azurecr.io/agenticwaf-worker:latest

# Push to ACR
az acr login --name <your-acr>
docker push <your-acr>.azurecr.io/agenticwaf-worker:latest
```

### Step 3: Update Container App with Image

Update `infra/bicep/main.bicep` line 108:
```bicep
containerImage: '<your-acr>.azurecr.io/agenticwaf-worker:latest'
```

Redeploy:
```bash
az deployment group create \
  --resource-group rg-kapodeistria-3079 \
  --name agentic-hybrid-deployment \
  --template-file infra/bicep/main.bicep \
  --parameters @infra/bicep/main.parameters.json
```

### Step 4: Deploy Webapp

```bash
cd webapp
npm install
./redeploy.sh deploy
```

## 📊 Monitoring

### Check Service Bus Metrics
```bash
# Check queue length
az servicebus queue show \
  --resource-group rg-kapodeistria-3079 \
  --namespace-name <namespace> \
  --name casestudy-jobs \
  --query "countDetails"

# Check dead letter queue
az servicebus queue show \
  --resource-group rg-kapodeistria-3079 \
  --namespace-name <namespace> \
  --name casestudy-jobs \
  --query "countDetails.deadLetterMessageCount"
```

### Check Container App Logs
```bash
# Stream worker logs
az containerapp logs show \
  --resource-group rg-kapodeistria-3079 \
  --name agenticpoc-worker \
  --follow

# Check replica count
az containerapp revision list \
  --resource-group rg-kapodeistria-3079 \
  --name agenticpoc-worker \
  --query "[0].properties.replicas"
```

### Check Webapp Status
```bash
# Test health endpoint
curl https://agenticwaf-webapp.azurewebsites.net/api/health

# Submit test job
curl -X POST https://agenticwaf-webapp.azurewebsites.net/api/case-study/submit \
  -H "Content-Type: application/json" \
  -d '{"caseStudyInput":"Test case study","quickMode":true}'

# Check job status
curl https://agenticwaf-webapp.azurewebsites.net/api/case-study/status/<sessionId>
```

## 💰 Cost Breakdown

### Current Configuration
- **App Service (B1)**: ~$13/month - Webapp UI
- **Service Bus (Standard)**: ~$10/month - Message queue
- **Container Apps**: ~$0-30/month - Pay per use (scale to zero)
- **Log Analytics**: ~$2/month - Logs and monitoring
- **Total**: ~$25-55/month + AI usage

### Cost Optimization
- Container App scales to zero when idle (no cost)
- Service Bus Standard tier supports multiple queues
- Webapp can stay on B1 tier (lightweight)
- Consider Azure Spot instances for Container Apps

## 🔧 Troubleshooting

### Job Stuck in Queue
```bash
# Check worker logs
az containerapp logs show -g rg-kapodeistria-3079 -n agenticpoc-worker --follow

# Check worker replica count
az containerapp show -g rg-kapodeistria-3079 -n agenticpoc-worker --query "properties.template.scale"

# Manually scale up
az containerapp update -g rg-kapodeistria-3079 -n agenticpoc-worker --min-replicas 1
```

### Worker Not Processing
```bash
# Check if worker is receiving messages
az containerapp logs show -g rg-kapodeistria-3079 -n agenticpoc-worker --tail 100

# Check Service Bus connection
az servicebus namespace authorization-rule keys list \
  --resource-group rg-kapodeistria-3079 \
  --namespace-name <namespace> \
  --name RootManageSharedAccessKey
```

### Status Updates Not Showing
```bash
# Check status queue has messages
az servicebus queue show \
  --resource-group rg-kapodeistria-3079 \
  --namespace-name <namespace> \
  --name casestudy-status \
  --query "countDetails.activeMessageCount"

# Check webapp logs
cd webapp && ./redeploy.sh logs
```

## 🎯 Next Steps

1. **Set up Azure Container Registry** for worker images
2. **Build and push worker Docker image**
3. **Update Bicep with ACR image URL**
4. **Deploy infrastructure and webapp**
5. **Test end-to-end flow**
6. **Set up monitoring and alerts**
7. **Configure auto-scaling rules**
8. **Add authentication (Azure AD)**
