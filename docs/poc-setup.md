# Agentic PoC Runbook

Follow this guide to spin up the proof-of-concept environment and publish case study outputs for anonymous viewing.

## 1. Provision infrastructure
Deploy the Bicep stack (see `infra/bicep/README.md`) to create:
- Azure Storage with public `final-artifacts` container and static website
- Azure ML workspace for Prompt Flow orchestration
- Azure OpenAI account plus GPT deployment

Capture the deployment outputs:
- `staticWebsiteUrl`
- `artifactContainerUrl`
- `openAiEndpoint`
- `openAiDeploymentName`

## 2. Configure local environment
Create `.env.local` with the Azure OpenAI values so the agents can connect:
```ini
AZURE_OPENAI_API_KEY=<your key>
AZURE_OPENAI_ENDPOINT=<openAiEndpoint output>
MODEL_DEPLOYMENT_NAME=<openAiDeploymentName output>
```
Run `npm install` once if dependencies are missing.

## 3. Run and publish a case study
Use the automation script to execute the agentic workflow and push results to Azure Storage:
```bash
scripts/poc/run-and-publish.sh \
  --storage-account <storageAccountName> \
  -i case-study.txt
```
The script will:
- Show the current agent configuration (`npm run status`)
- Execute the multi-agent assessment via `src/cli/poc-runner.ts`
- Upload the generated folder to the public `final-artifacts` container
- Regenerate the static `index.html` at the storage static website endpoint

Outputs:
- Blob artefacts: `https://<storageAccount>.blob.core.windows.net/final-artifacts/`
- Static index: value printed by the script (queried from `az storage account show --query primaryEndpoints.web`)

Share the static index URL with stakeholders—they can browse/download the files without signing in.

## 4. Optional parameters
```
scripts/poc/run-and-publish.sh --help
```
Customise the staging directory, override the container name, or skip the status check for faster iterations.

## 5. Clean up
Remove the resource group when finished:
```bash
az group delete --name <resource-group> --yes --no-wait
```
