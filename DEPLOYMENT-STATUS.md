# Hybrid Architecture Deployment Status

> **Note (2025-10-01)**
> The Container App worker (`agenticwaf-worker`) is the active production path again. The checklist below reflects the current configuration.

## 🚀 Deployment Summary

**Date**: 2025-10-01
**Deployment Type**: Service Bus + Container Apps
**Status**: ✅ Production

## ✅ Completed Steps

### 1. Azure Container Registry
- **Name**: agenticwafacr
- **Login Server**: agenticwafacr.azurecr.io
- **Status**: ✅ Created
- **Worker Image**: agenticwaf-worker:latest
- **Build**: ✅ Completed successfully

### 2. Infrastructure Code
- **Service Bus Module**: `infra/bicep/modules/servicebus.bicep`
- **Container App Module**: `infra/bicep/modules/containerapp.bicep`
- **Main Bicep**: Updated with hybrid architecture
- **Status**: ✅ Ready

### 3. Worker Application
- **Location**: `/worker`
- **Dockerfile**: Created with full project dependencies
- **Package**: Node.js with @azure/service-bus
- **Image**: Built and pushed to ACR
- **Status**: ✅ Ready

### 4. Webapp Updates
- **Service Bus Integration**: ✅ Added @azure/service-bus SDK
- **Job Submission**: ✅ Updated to submit to queue
- **Real-time Status**: ✅ SSE already implemented
- **Status**: ✅ Code ready for deployment

## 🔄 In Progress

### Azure Resource Deployment
- **Service Bus Namespace**: Creating queues (casestudy-jobs, casestudy-status)
- **Container App Environment**: Provisioning with Log Analytics
- **Container App Worker**: Deploying with auto-scale 0-5
- **WebApp Configuration**: Updating with Service Bus connection strings
- **ACR Permissions**: Granting AcrPull role to Container App

**Estimated Time**: 5-10 minutes for Container Apps provisioning

## 📋 Next Steps (Legacy Flow)

1. **Verify Infrastructure**
   ```bash
   # Check Service Bus
   az servicebus namespace show -g rg-kapodeistria-3079 -n <namespace> --query "name"

   # Check Container App
   az containerapp show -g rg-kapodeistria-3079 -n agenticpoc-worker --query "properties.provisioningState"

   # Check WebApp
   curl https://agenticwaf-webapp.azurewebsites.net/api/health
   ```

2. **Deploy WebApp Code**
   ```bash
   cd webapp
   ./redeploy.sh deploy
   ```

3. **Test End-to-End Flow**
   ```bash
   # Submit test job
   curl -X POST https://agenticwaf-webapp.azurewebsites.net/api/case-study/submit \
     -H "Content-Type: application/json" \
     -d '{"caseStudyInput":"Build an e-commerce platform","quickMode":true}'

   # Monitor status
   curl https://agenticwaf-webapp.azurewebsites.net/api/case-study/status/<sessionId>
   ```

4. **Monitor Worker Logs**
   ```bash
   az containerapp logs show -g rg-kapodeistria-3079 -n agenticpoc-worker --follow
   ```

## 📊 Architecture Components

```
┌─────────────┐
│ User Browser│
└──────┬──────┘
       │ HTTPS
       ↓
┌────────────────────┐
│ Azure Web App      │
│ - Job submission   │
│ - SSE status       │
└──────┬─────────────┘
       │ Messages
       ↓
┌────────────────────┐
│ Service Bus        │
│ ├─ jobs queue      │
│ └─ status queue    │
└──────┬─────────────┘
       │
       ↓
┌────────────────────┐
│ Container Worker   │
│ - Processes jobs   │
│ - Publishes status │
└────────────────────┘
```

## 🔐 Security Features

- ✅ Service Bus connection strings (not API keys in webapp)
- ✅ Container App Managed Identity
- ✅ ACR authentication via managed identity
- ✅ Service Bus queue isolation
- ✅ Auto-scale to zero when idle

## 💰 Cost Estimate

- **WebApp (B1)**: ~$13/month
- **Service Bus (Standard)**: ~$10/month
- **Container Apps**: ~$0-30/month (scales to zero)
- **Container Registry (Basic)**: ~$5/month
- **Log Analytics**: ~$2/month
- **Total**: ~$30-60/month + AI usage

## 🔍 Troubleshooting

### If deployment fails:
```bash
# Check deployment errors
az deployment group show -g rg-kapodeistria-3079 -n <deployment-name> \
  --query "properties.error"

# Check resource provisioning
az resource list -g rg-kapodeistria-3079 -o table
```

### If worker doesn't start:
```bash
# Check replica count
az containerapp revision list -g rg-kapodeistria-3079 -n agenticpoc-worker \
  --query "[0].properties.replicas"

# Check logs for errors
az containerapp logs show -g rg-kapodeistria-3079 -n agenticpoc-worker --tail 100
```

### If jobs aren't processing:
```bash
# Check queue message count
az servicebus queue show -g rg-kapodeistria-3079 \
  --namespace-name <namespace> \
  --name casestudy-jobs \
  --query "countDetails.activeMessageCount"

# Force scale up worker
az containerapp update -g rg-kapodeistria-3079 -n agenticpoc-worker --min-replicas 1
```

## 📚 Documentation

- **Architecture**: `/HYBRID-ARCHITECTURE.md`
- **Original Deployment**: `/webapp/DEPLOYMENT.md`
- **README**: `/webapp/README.md`
