# Agentic Well-Architected Framework - Web Application

Web interface for the Agentic WAF system that allows users to submit case studies and generate comprehensive Azure architecture analyses using AI agents.

## Features

- 🎨 Clean, modern UI for submitting case studies
- 🤖 Integration with multi-agent orchestration system
- 📊 Real-time processing status
- 📁 Browse recent case study outputs
- ☁️ Deployed on Azure App Service

## Architecture

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Azure App     │
│   Service       │
│  (Node.js API)  │
└────────┬────────┘
         │
         ├─────────→ Azure OpenAI (GPT-4.1)
         │
         ├─────────→ AI Foundry Agents
         │
         └─────────→ Blob Storage (Artifacts)
```

## Local Development

1. **Install dependencies:**
   ```bash
   cd webapp
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Azure credentials
   ```

3. **Run locally:**
   ```bash
   npm run dev
   ```

4. **Access the app:**
   Open http://localhost:8080

## Deployment

### Deploy to Azure

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
- Install dependencies
- Create a deployment package
- Upload to Azure Web App
- Restart the service

### Manual Deployment

```bash
# Build deployment package
npm install --production
zip -r deploy.zip . -x "*.git*" ".env*"

# Deploy via Azure CLI
az webapp deployment source config-zip \
  --resource-group rg-kapodeistria-3079 \
  --name agenticwaf-webapp \
  --src deploy.zip
```

## Infrastructure

Infrastructure is defined in `/infra/bicep/` and includes:

- **App Service Plan** (B1 Basic tier)
- **Web App** (Node.js 20 LTS)
- **Application Insights** (via ML Workspace)
- **Storage Account** (for artifacts)

Deploy infrastructure:
```bash
cd infra
python3 -m venv .venv
source .venv/bin/activate
pip install azure-identity azure-mgmt-resource
python3 deploy.py
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Submit Case Study
```
POST /api/case-study/submit
{
  "caseStudyInput": "...",
  "quickMode": false
}
```

### Get Job Status
```
GET /api/case-study/status/:sessionId
```

### List Outputs
```
GET /api/outputs
```

## Configuration

Environment variables set via Azure App Service configuration:

| Variable | Description |
|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | GPT model deployment name |
| `AZURE_ML_WORKSPACE_NAME` | ML workspace for agents |
| `STORAGE_ACCOUNT_NAME` | Storage account name |
| `ARTIFACT_CONTAINER_URL` | Blob container URL for outputs |

## Monitoring

- **Application Insights**: Integrated via ML Workspace
- **App Service Logs**: `az webapp log tail -g rg-kapodeistria-3079 -n agenticwaf-webapp`
- **Health Endpoint**: `/api/health`

## URLs

- **Production**: https://agenticwaf-webapp.azurewebsites.net
- **ML Studio**: https://ml.azure.com/rp/workspaces/agenticwaf-mlw
- **Artifacts**: https://agenticwafartifactsthkyg.blob.core.windows.net/final-artifacts

## Troubleshooting

### Web app not starting
```bash
# Check logs
az webapp log tail -g rg-kapodeistria-3079 -n agenticwaf-webapp

# Restart app
az webapp restart -g rg-kapodeistria-3079 -n agenticwaf-webapp
```

### Missing environment variables
```bash
# Check app settings
az webapp config appsettings list -g rg-kapodeistria-3079 -n agenticwaf-webapp

# Set a variable
az webapp config appsettings set -g rg-kapodeistria-3079 -n agenticwaf-webapp \
  --settings KEY=VALUE
```

## Security

- ✅ HTTPS only
- ✅ Managed identity enabled
- ✅ TLS 1.2 minimum
- ✅ CORS configured
- ⚠️ Add authentication for production use

## Next Steps

- [ ] Add Azure AD authentication
- [ ] Implement job queue (Azure Service Bus)
- [ ] Add WebSocket for real-time progress
- [ ] Implement user sessions and history
- [ ] Add rate limiting
- [ ] Set up CI/CD pipeline