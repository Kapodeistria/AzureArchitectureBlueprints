# Deployment Guide - Agentic WAF Web Application

This document explains the two deployment modes for the webapp and how to set them up.

## 🎯 Deployment Modes

### Mode 1: UI-Only (Current Deployment)
**Status**: ✅ Currently deployed at https://agenticwaf-webapp.azurewebsites.net

**What it does:**
- Provides web interface for case study input
- Shows detailed error logs and configuration status
- Validates configuration and provides helpful guidance
- Directs users to use the CLI for actual processing

**What it doesn't do:**
- Does NOT run the AI agent orchestration
- Does NOT generate case study outputs
- Does NOT call Azure AI Foundry agents

**Use case:**
- Landing page / marketing site
- Configuration testing
- User guidance to CLI

**Deployment:**
```bash
cd webapp
npm install
npm run build
az webapp deploy --resource-group rg-kapodeistria-3079 \
  --name agenticwaf-webapp --src-path deploy.zip --type zip
```

---

### Mode 2: Full Stack (Not Yet Deployed)
**Status**: ⚠️ Not deployed - requires complete project upload

**What it would do:**
- Accept case study submissions via web
- Execute full AI agent orchestration
- Generate comprehensive architecture analysis
- Store results in Azure Storage
- Provide download links to generated artifacts

**What it requires:**
1. **Complete Project Files**:
   - All TypeScript source code (`src/`)
   - All agent configurations (`config/`)
   - Node modules (`node_modules/`)
   - TypeScript compiler (`tsx`)
   - All dependencies from package.json

2. **Azure Configuration**:
   - Azure OpenAI API key (currently using managed identity)
   - AI Foundry workspace credentials
   - Storage account access
   - Sufficient compute resources (upgrade from B1 to S1+)

3. **Build Process**:
   - Compile TypeScript to JavaScript
   - Bundle dependencies
   - Set up proper environment variables
   - Configure startup command

---

## 📦 Deploying Full Stack Mode

### Step 1: Prepare Complete Deployment Package

```bash
# From project root
cd /path/to/interviews

# Install all dependencies
npm install

# Create deployment package with ALL files
zip -r webapp-fullstack.zip . \
  -x "*.git*" \
  -x "node_modules/@types/*" \
  -x "*.md" \
  -x "tests/*" \
  -x ".env*"
```

### Step 2: Update App Service Plan

```bash
# Upgrade to S1 tier for better performance
az appservice plan update \
  --resource-group rg-kapodeistria-3079 \
  --name agenticwaf-asp \
  --sku S1
```

### Step 3: Configure Environment Variables

```bash
# Set all required variables
az webapp config appsettings set \
  --resource-group rg-kapodeistria-3079 \
  --name agenticwaf-webapp \
  --settings \
    AZURE_OPENAI_API_KEY="<your-key>" \
    AZURE_OPENAI_ENDPOINT="https://kapodeistria-1337-resource.cognitiveservices.azure.com/" \
    AZURE_OPENAI_DEPLOYMENT_NAME="kapodeistria-1337" \
    FOUNDRY_PROJECT_ID="<project-id>" \
    FOUNDRY_ENDPOINT="<foundry-endpoint>" \
    NODE_ENV="production" \
    SCM_DO_BUILD_DURING_DEPLOYMENT="true"
```

### Step 4: Update Startup Command

```bash
# Set custom startup command to run webapp server
az webapp config set \
  --resource-group rg-kapodeistria-3079 \
  --name agenticwaf-webapp \
  --startup-file "node webapp/src/server.js"
```

### Step 5: Deploy

```bash
az webapp deploy \
  --resource-group rg-kapodeistria-3079 \
  --name agenticwaf-webapp \
  --src-path webapp-fullstack.zip \
  --type zip \
  --timeout 600000
```

---

## 🔍 Current Status Check

```bash
# Check current deployment mode
curl -s https://agenticwaf-webapp.azurewebsites.net/api/health | jq .

# Test case study submission
curl -s -X POST https://agenticwaf-webapp.azurewebsites.net/api/case-study/submit \
  -H "Content-Type: application/json" \
  -d '{"caseStudyInput":"Test case study","quickMode":true}' \
  | jq '.status'

# Expected output for UI-only mode: "not_implemented"
# Expected output for full-stack mode: "completed" or "processing"
```

---

## 📊 Architecture Comparison

### UI-Only Mode (Current)
```
┌─────────────┐
│  Web Browser│
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────┐
│  Web Server │ ← Express.js only
│  (Node.js)  │ ← Validates config
└─────────────┘ ← Returns "not implemented"
```

### Full Stack Mode (Future)
```
┌─────────────┐
│  Web Browser│
└──────┬──────┘
       │ HTTP
       ↓
┌─────────────────────┐
│  Web Server         │
│  (Node.js)          │
└──────┬──────────────┘
       │
       ├──────────→ TypeScript Orchestrator
       │
       ├──────────→ AI Foundry Agents
       │            (Research, Architecture, WAF, etc.)
       │
       └──────────→ Azure Storage
                    (Output artifacts)
```

---

## 🚨 Important Considerations

### Performance
- **UI-Only**: ~50ms response time, minimal resources
- **Full Stack**: 2-10 minutes processing time per case study
- **Resource Requirements**: S1 tier minimum (1.75 GB RAM)

### Cost
- **UI-Only**: ~$13/month (B1 tier)
- **Full Stack**: ~$75/month (S1 tier) + OpenAI usage

### Security
- **UI-Only**: No API keys needed (uses managed identity for config check)
- **Full Stack**: Requires API keys or properly configured managed identity

### Scalability
- **UI-Only**: Can handle hundreds of concurrent users
- **Full Stack**: Limited by agent processing (1-2 concurrent jobs max on S1)

---

## 🎯 Recommendation

**For Production:**
1. Keep **UI-Only mode** for the public web interface
2. Provide clear instructions to use the **CLI** for actual processing
3. Offer **GitHub repo** link for users who want to run it themselves
4. Consider **Azure Functions** or **Container Apps** for serverless agent execution

**Advantages:**
- ✅ Lower cost
- ✅ Better security (no API keys in web app)
- ✅ Faster response times
- ✅ Easier to maintain
- ✅ CLI provides better control and debugging

---

## 📝 Next Steps

To enable full stack mode:

1. **Authentication**: Add Azure AD sign-in
2. **Job Queue**: Implement background processing with Azure Service Bus
3. **Resource Scaling**: Use auto-scaling or serverless compute
4. **Monitoring**: Set up Application Insights alerts
5. **Rate Limiting**: Prevent abuse and control costs

Or, keep the webapp as a landing page and let users clone the repo to run locally! 🚀