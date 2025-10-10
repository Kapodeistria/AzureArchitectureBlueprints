# Agentic Well-Architected Blueprint

> **Automated Microsoft Well-Architected Framework assessments powered by AI agents**

Transform your Azure architecture requirements into comprehensive WAF assessments in minutes. This platform uses 11 specialized AI agents to analyze your systems across all 5 WAF pillars—Security, Reliability, Performance, Cost Optimization, and Operational Excellence—generating detailed reports, compliance scores, and actionable improvement roadmaps.

## What It Does

- **Input**: Describe your Azure architecture or requirements (plain text, case study format)
- **Process**: 11 AI agents analyze your system using official Microsoft WAF methodology
- **Output**: Complete assessment with pillar scores (0-10), architecture diagrams, cost analysis, risk assessment, and implementation roadmap

**Built for**: Cloud architects, solution designers, and technical teams who need rapid WAF compliance assessments.

## Recent Updates (v7.3.1)

- **React File Preview**: Modern TypeScript component with markdown rendering and terminal view for architecture diagrams
- **Session Persistence**: Share assessment URLs that survive webapp restarts via Azure Blob Storage
- **Canonical Output**: Every assessment generates 7 standard files for consistent frontend integration
- **Security**: DOMPurify sanitization and XSS protection for all content

---

## How It Works

The platform analyzes your architecture across Microsoft's 5 Well-Architected Framework pillars:

| Pillar | What It Evaluates | Sample Output |
|--------|-------------------|---------------|
| 🛡️ **Reliability** | RTO/RPO, availability zones, disaster recovery | Resiliency score (0-10) + recovery patterns |
| 🔒 **Security** | Zero Trust, encryption, threat protection | Security posture score + control recommendations |
| ⚡ **Performance** | Scalability, monitoring, optimization | Performance targets + scaling strategy |
| 🔧 **Operational Excellence** | DevOps, automation, deployment safety | Operational maturity score + CI/CD roadmap |
| 💰 **Cost Optimization** | Financial management, waste reduction | Cost efficiency score + savings opportunities |

**Assessment Process**: Research (45-120s) → WAF Analysis (120-180s) → Reporting → Total: **3-5 minutes**

---

## Quick Start

### 1. Configure Azure OpenAI

```bash
cp .env.example .env.local
# Add your Azure OpenAI credentials to .env.local
```

### 2. Deploy Agents

```bash
npm run agents:deploy  # Deploy all 11 WAF assessment agents
npm run agents:status  # Verify deployment
```

### 3. Run Assessment

```bash
npm run quick         # Fast assessment (5 minutes)
npm run local         # Full assessment with research intelligence
npm run interactive   # Guided pillar-by-pillar analysis
```

---

## 🔍 **System Architecture**

### **Complete WAF Assessment Workflow**

```
                ┌─────────────────────────────────────┐
                │   🎯 WAF Assessment Orchestrator   │
                └─────────────────┬───────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
 ┌───────────────┐      ┌─────────────────┐      ┌────────────────┐
 │ 0: RESEARCH   │      │ 2.5-4: VISUAL   │      │ 5-6: ANALYSIS  │
 │    & DESIGN   │─────▶│    & WAF        │─────▶│  & REFINEMENT  │
 └───────────────┘      └─────────────────┘      └────────────────┘
         │                        │                        │
         │                        │                        │
    (6 agents)             (1 + 5 agents)           (3 + loop + 1)
    45-120s                   120-180s                  90s+

  🔍 Research (6)          🎨 Visual (1)            📊 Analysis (3)
  ┌───────────┐            ┌──────────┐            ┌──────────┐
  │Infra & WAF│            │Diagrams  │            │Cost      │
  │AI/ML WAF  │            └──────────┘            │Risk      │
  │Enterprise │            🏛️ WAF (5)              │Change    │
  │Compliance │            ┌──────────┐            └──────────┘
  │Industry   │            │Reliability│
  │Arch & WAF │            │Security  │            🔄 Refinement
  └───────────┘            │Performanc│            ┌──────────┐
  📋 Requirements          │Operation │            │Score ≥ 8?│
  🏗️ Architecture          │Cost Opt  │            │  NO ─┐   │
                           └──────────┘            │   ▼  │   │
                                                   │ Refine  │
                                                   │   │  │   │
                                                   │   └──┘   │
                                                   │  (max 5) │
                                                   │   YES    │
                                                   └──────────┘
                                                   📝 Documentation
```

### **Azure AI Foundry Integration**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    🤖 AZURE AI FOUNDRY DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Agent Registry:        foundry-agents/agent-ids.env                   │
│  ──────────────                                                        │
│  FOUNDRY_AGENT_RELIABILITY_ID=agent-reliability-123456789              │
│  FOUNDRY_AGENT_SECURITY_ID=agent-security-123456789                    │
│  FOUNDRY_AGENT_PERFORMANCE_ID=agent-performance-123456789              │
│  ... all 11 agents tracked                                             │
│                                                                         │
│  Deployment Commands:                                                   │
│  ──────────────────                                                     │
│  npm run agents:deploy    # Deploy all agents                          │
│  npm run agents:redeploy  # Delete and redeploy with new IDs          │
│  npm run agents:delete    # Remove all deployed agents                 │
│  npm run agents:status    # Check current deployment status            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 **Available Commands**

### **WAF Assessment Commands**
| Command | Description | WAF Features |
|---------|-------------|-------------|
| `npm run quick` | **Complete WAF assessment** | Full 5-pillar compliance analysis |
| `npm run local` | **Enhanced WAF + Research** | 11-agent assessment with intelligence |
| `npm run interactive` | **Guided pillar evaluation** | Step-by-step WAF assessment |
| `npm run analyze` | **Custom WAF workflows** | Advanced assessment options |

### **Agent Management Commands**
| Command | Description | Purpose |
|---------|-------------|---------|
| `npm run agents:deploy` | Deploy all WAF agents | Initial setup or updates |
| `npm run agents:redeploy` | Delete and redeploy fresh | Clean slate deployment |
| `npm run agents:delete` | Remove all agents | Cleanup or reset |
| `npm run agents:status` | Check deployment status | Registry verification |

### **Development & Testing**
| Command | Description | Use Case |
|---------|-------------|----------|
| `npm test` | Validate WAF system | Test all agents and scoring |
| `npm run config:validate` | Check configuration | Verify Azure connectivity |
| `npm run deploy:foundry` | Generate Foundry configs | Advanced deployment setup |

## 🚀 **Run Modes: Local CLI vs Production WebApp**
- **Local CLI (development)**: run `npm run analyze` (or `npx tsx src/cli/interview-cli.ts analyze`) for rapid iteration. Set `CASE_STUDY_SESSION_ID` when you want Service Bus telemetry; every agent publishes progress and fallback metadata to `casestudy-status`.
- **Production WebApp (Container Worker)**: submit jobs through the Azure WebApp UI. Messages land on `casestudy-jobs` and the Container App worker processes them, publishing progress to `casestudy-status` for the UI.
- Durable Functions has been retired; the Container App worker is once again the production orchestration path.

### One-command Cloud Deploy

Use the bundled script to ship both the container worker and the Web App:

```bash
npm run deploy:cloud
```

Environment variables (override as needed):

| Variable | Default |
| --- | --- |
| `AZURE_RESOURCE_GROUP` | `rg-kapodeistria-3079` |
| `AZURE_WEBAPP_NAME` | `agenticwaf-webapp` |
| `AZURE_CONTAINERAPP_NAME` | `agenticwaf-worker` |
| `AZURE_CONTAINER_ENVIRONMENT` | `agenticwaf-cae` |
| `AZURE_CONTAINER_REGISTRY` | `agenticwafacr` |
| `ACR_IMAGE_NAME` | `agenticwafworker` |

The script:
1. Builds a fresh container image via `az acr build`
2. Updates Container App and Web App **in parallel** (faster deployment!)
3. Verifies health of both services

⚡ **Parallel deployment** saves ~30-50% of total deployment time by running Container App and Web App updates simultaneously.

### 🗄️ **Azure Storage Setup for Artifacts**

Generated case study files are stored in Azure Blob Storage. Quick setup:

```bash
# Automatically fetch connection string
./scripts/setup-storage-env.sh
```

This will retrieve your storage credentials and show you what to add to `.env.local`.

**Manual setup:**
```bash
# Get connection string
az storage account show-connection-string \
  --name agenticwafartifactsthkyg \
  --resource-group rg-kapodeistria-3079 \
  --query connectionString -o tsv

# Add to .env.local
ARTIFACTS_STORAGE_CONNECTION="DefaultEndpointsProtocol=https;AccountName=..."
STORAGE_ACCOUNT_NAME=agenticwafartifactsthkyg
```

For production Web App and Container App, set the same variables via:
```bash
az webapp config appsettings set --name agenticwaf-webapp \
  --resource-group rg-kapodeistria-3079 \
  --settings AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
```

📚 **See [docs/STORAGE-SAS-SETUP.md](docs/STORAGE-SAS-SETUP.md)** for detailed configuration including SAS tokens, managed identity, and troubleshooting.

## 💬 **Live Feedback Console**
- The web app includes a command console area that surfaces telemetry from `casestudy-status` (and can be wired to `casestudy-commands` if a worker is reintroduced).
- Backend requirements:
  - Configure `SERVICE_BUS_COMMAND_QUEUE` if you plan to enable live commands for the worker (queue exists but processing is optional).
  - Provide a SAS connection string with **Send** rights (e.g. `TelemetrySend`) via `SERVICE_BUS_CONNECTION` for the web app and worker.
- At present the console operates in read-only mode, surfacing raw telemetry payloads (progress, completed agents, errors) so you can debug the pipeline without opening the Azure portal.

---

## Output Files

Each assessment generates a timestamped folder with these files:

### Main Deliverables
1. **`solution-*.md`** - **Complete integrated report** with all analysis sections, architecture design, and recommendations
2. **`quick-summary-*.md`** - Executive summary with key talking points and highlights

### Canonical WAF Pillar Files
3. **`architecture-overview.md`** - Complete architecture design
4. **`waf-security-analysis.md`** - Security pillar assessment
5. **`reliability-assessment.md`** - Reliability pillar analysis
6. **`performance-optimization.md`** - Performance recommendations
7. **`cost-analysis.md`** - Cost optimization opportunities
8. **`operational-excellence.md`** - DevOps and automation roadmap
9. **`executive-summary.md`** - Comprehensive WAF compliance report with scores

### Metadata & Debug Files
- **`performance-report-*.json`** - Execution metrics and timing data
- **`metadata-*.json`** - Workflow tracking and WAF scores
- **`agent-reports/`** subfolder - Detailed timestamped outputs from each agent for debugging

---

## Key Features

- **Official WAF Methodology**: Complete Microsoft framework implementation
- **Fast Assessments**: 3-5 minutes for full analysis (6 research + 5 WAF + 3 analysis agents in parallel)
- **Quantified Scoring**: 0-10 scale per pillar with detailed justification
- **Architecture Refinement**: Iterative improvement loop until satisfaction score ≥ 8.0/10
- **Research Intelligence**: Latest 2024-2025 Azure patterns, enterprise cases, compliance requirements
- **Cost Optimization**: Intelligent model selection (GPT-3.5 for simple tasks, 15x cheaper)
- **Reliability**: Circuit breaker pattern, graceful degradation, 30s agent timeouts
- **Azure Integration**: Deployed via Azure AI Foundry with agent registry tracking

---

## Troubleshooting

- **Configuration Issues**: `npm run config:validate`
- **Agent Deployment**: `npm run agents:status`
- **Assessment Failures**: Verify Azure OpenAI quota and connectivity
- **Registry Problems**: `npm run agents:redeploy` for clean redeployment

## Requirements

- Azure OpenAI service with GPT-4 access
- Node.js 18+ and npm
- Azure AI Foundry workspace (optional)
- Azure Blob Storage for session persistence (production)

---

*Built with TypeScript, Azure OpenAI, and official Microsoft WAF methodology*
