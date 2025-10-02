# Environment & Service Map

This document captures the authoritative view of which Azure resources power the deployed Agentic Well-Architected platform and the environment variables each component expects. Use this as the source of truth when validating configuration or provisioning keys for the next set of agents/operators.

## Resource Group

All live resources sit in a single resource group:

```
rg-kapodeistria-3079
```

Scripts in the repo still default to `rg-agentic-waf`. Override those defaults by exporting:

```bash
export AZURE_RESOURCE_GROUP=rg-kapodeistria-3079
```

before running any deployment scripts.

## Core Azure Services

| Service | Resource Name | Notes |
| --- | --- | --- |
| Service Bus Namespace | `agenticwaf-sb-sdgidtuwrvkf2` | Hosts job, status, and command queues |
| Container App Worker | `agenticwaf-worker` | Processes jobs from `casestudy-jobs`, publishes telemetry |
| Web App (Node/Express) | `agenticwaf-webapp` | Frontend UI + API gateway to Service Bus |
| Storage Account | `agenticwafartifactsthkyg` | Stores generated artifacts in `final-artifacts` container |
| Azure OpenAI | `kapodeistria-1337` | Endpoint: `https://kapodeistria-1337-resource.cognitiveservices.azure.com` |

## Service Bus Queues & Policies

| Queue | Purpose | Publishers | Consumers |
| --- | --- | --- | --- |
| `casestudy-jobs` | Job submissions | Web App | Container App worker |
| `casestudy-status` | Telemetry updates (progress, results) | Worker | Web App, telemetry monitor |
| `casestudy-commands` | (Reserved) Live feedback/prompt injections | Web UI command console | Optional worker command handler |

### Shared Access Policies

Create SAS policies at the namespace level:

- `TelemetrySend`: **Send + Listen** rights. Used by components that must publish (web app, worker).
- `TelemetryPeek`: **Listen only**. Used by monitoring scripts.

To generate/retrieve keys:

```bash
az servicebus namespace authorization-rule create \
  --resource-group rg-kapodeistria-3079 \
  --namespace-name agenticwaf-sb-sdgidtuwrvkf2 \
  --name TelemetrySend \
  --rights Send Listen

az servicebus namespace authorization-rule keys list \
  --resource-group rg-kapodeistria-3079 \
  --namespace-name agenticwaf-sb-sdgidtuwrvkf2 \
  --name TelemetrySend \
  --query primaryConnectionString -o tsv
```

## Environment Variables by Component

### Web App (`agenticwaf-webapp`)

| Variable | Description |
| --- | --- |
| `SERVICE_BUS_CONNECTION` | SAS connection string with Send rights (e.g. TelemetrySend) |
| `SERVICE_BUS_JOB_QUEUE` | Defaults to `casestudy-jobs` |
| `SERVICE_BUS_STATUS_QUEUE` | Defaults to `casestudy-status` |
| `SERVICE_BUS_COMMAND_QUEUE` | Optional. Defaults to `casestudy-commands` (unused while container worker is disabled) |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME` | OpenAI endpoint + deployment |
| `AZURE_ML_WORKSPACE_NAME` | For telemetry/logging tie-ins |
| `STORAGE_ACCOUNT_NAME` | Optional; used to display file download links |
| `ARTIFACT_CONTAINER_URL` | Base URL for final artifacts |

### Container App Worker (`agenticwaf-worker`)

| Variable | Description |
| --- | --- |
| `SERVICE_BUS_CONNECTION` | SAS connection string (stored as secret) |
| `SERVICE_BUS_NAMESPACE` | FQDN used when falling back to managed identity auth |
| `SERVICE_BUS_JOB_QUEUE` | Defaults to `casestudy-jobs` |
| `SERVICE_BUS_STATUS_QUEUE` | Defaults to `casestudy-status` |
| `SERVICE_BUS_COMMAND_QUEUE` | Optional; enables live command handling |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME` | Passed through for AI orchestration |
| `STORAGE_ACCOUNT_NAME` / `ARTIFACTS_STORAGE_CONNECTION` | Enables artifact uploads |

## Storage

Artifacts are uploaded to the storage account `agenticwafartifactsthkyg`, container `final-artifacts`. Supply a connection string via `ARTIFACTS_STORAGE_CONNECTION` (worker) or `AZURE_STORAGE_CONNECTION_STRING` to ensure uploads succeed.

To retrieve the connection string:

```bash
az storage account show-connection-string \
  --resource-group rg-kapodeistria-3079 \
  --name agenticwafartifactsthkyg \
  --query connectionString -o tsv
```

### Production values (current)

```
STORAGE_ACCOUNT_NAME=agenticwafartifactsthkyg
ARTIFACTS_STORAGE_CONNECTION="BlobEndpoint=https://agenticwafartifactsthkyg.blob.core.windows.net/;QueueEndpoint=https://agenticwafartifactsthkyg.queue.core.windows.net/;FileEndpoint=https://agenticwafartifactsthkyg.file.core.windows.net/;TableEndpoint=https://agenticwafartifactsthkyg.table.core.windows.net/;SharedAccessSignature=sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-11-05T20:22:36Z&st=2025-10-01T11:07:36Z&spr=https&sig=bzWcMIfFLEllHp6ONjYCR9MNduV3SHNCSptagIyB6H8%3D"
ARTIFACTS_STORAGE_SAS="sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiytfx&se=2025-11-05T20:22:36Z&st=2025-10-01T11:07:36Z&spr=https&sig=bzWcMIfFLEllHp6ONjYCR9MNduV3SHNCSptagIyB6H8%3D"
```

Set these values in both the App Service (Configuration → Application settings) and the Container App (Secrets + Environment variables) so the web UI can list artifacts and the worker can upload them.

## Live Command Console (Web UI)

- The console currently operates in read-only mode (status telemetry only). `casestudy-commands` remains available for future interactive features—enable the worker handler before sending commands.
- Telemetry feed still renders raw `casestudy-status` payloads (progress, errors) so you can diagnose failures directly from the UI without opening the Azure portal.

## Verification Commands

```bash
# Check Service Bus namespace
az servicebus namespace show -n agenticwaf-sb-sdgidtuwrvkf2 -g rg-kapodeistria-3079

# Confirm Container App configuration
az containerapp show -n agenticwaf-worker -g rg-kapodeistria-3079 --query properties.template.containers[0].env

# Monitor telemetry
export SB_CONN="Endpoint=...;SharedAccessKeyName=TelemetryPeek;SharedAccessKey=..."
node scripts/tools/monitor-telemetry.js --continuous
```

Keep this file updated as we add new queues, secrets, or services so future operators (and agents) have a single point of reference.
