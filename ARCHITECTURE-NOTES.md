# Architecture Notes

## Current Implementation (v7.1.0)

### Architecture Overview

AgenticWAF is a **single-tier Node.js web application** deployed on **Azure App Service (Web App)** with integrated multi-agent orchestration.

### Primary Components

#### 1. **Azure App Service (Web App)** - Main Application
- **Location**: `/webapp/`
- **Runtime**: Node.js (Express.js)
- **Deployment**: Bicep module at `infra/bicep/modules/webapp.bicep` (if exists) or directly via `az webapp deploy`
- **Responsibilities**:
  - Serves frontend (SaaS-style landing page)
  - Hosts REST API endpoints (`/api/case-study/submit`, `/api/outputs`, `/api/version`)
  - Orchestrates AI agents in-process (no separate worker tier)
  - Streams real-time progress via Server-Sent Events (SSE)
  - Uploads generated artifacts to Azure Blob Storage
- **Status**: ✅ **DEPLOYED AND ACTIVE**

#### 2. **Azure OpenAI** - AI Models
- **Models Used**: GPT-4o, GPT-4, GPT-3.5
- **Integration**: Direct REST API calls from webapp
- **Usage**: Architecture analysis, diagram generation, scoring across 5 WAF pillars

#### 3. **Azure Blob Storage** - Artifact Storage
- **Container**: `final-artifacts`
- **Access**: SAS token-based (configured via environment variables)
- **Stores**: Generated case studies, diagrams (ASCII/PNG), JSON exports, markdown reports

### Removed/Obsolete Components

#### ❌ Azure Functions (Removed)
- **Previous Location**: `/functions/case-study-processor/`
- **Why Removed**: Consolidated into single-tier webapp for:
  - Simpler deployment model
  - Reduced cold start latency
  - Direct SSE streaming to clients
  - Lower operational complexity
- **Status**: Code removed, Bicep module deleted

#### ❌ Azure Durable Functions (Never Implemented)
- Was considered for long-running orchestration but not implemented
- In-process orchestration in webapp proved sufficient

#### ❌ Service Bus Queues (Removed)
- **Previous Queues**: `casestudy-jobs`, `casestudy-status`
- **Why Removed**: No longer needed with single-tier architecture
- Replaced by in-memory job tracking + SSE for real-time updates

#### ❌ Container Apps (Never Deployed)
- Module existed at `infra/bicep/modules/containerapp.bicep` but was never wired up
- Can be safely removed

### Deployment Model

#### Current Deployment Flow
1. **Build**: `npm install --production` in `/webapp`
2. **Package**: Zip webapp code (`deploy.zip`)
3. **Deploy**: `az webapp deploy --src-path deploy.zip`
4. **Script**: `webapp/redeploy.sh` handles full deployment pipeline

#### Environment Variables
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_STORAGE_ACCOUNT_NAME`
- `AZURE_STORAGE_SAS_TOKEN`
- `AZURE_STORAGE_CONTAINER_NAME` (default: `final-artifacts`)

### Infrastructure-as-Code

#### Bicep Structure
- **Main**: `infra/bicep/main.bicep`
- **Modules**:
  - `modules/webapp.bicep` - App Service plan + Web App
  - `modules/storage.bicep` - Blob storage account
  - `modules/openai.bicep` - Azure OpenAI service
  - ~~`modules/functionapp.bicep`~~ (removed)
  - ~~`modules/containerapp.bicep`~~ (obsolete, can remove)

### Known Limitations

1. **No persistent job queue**: Jobs are processed in-memory; server restart clears active jobs
2. **Single instance**: No horizontal scaling configured (can be added via App Service scaling rules)
3. **SSE limitations**: Client must maintain connection; disconnects lose real-time updates (can poll `/api/case-study/status/{sessionId}` as fallback)
4. **SAS token rotation**: Currently manual; production should use Managed Identity + RBAC

