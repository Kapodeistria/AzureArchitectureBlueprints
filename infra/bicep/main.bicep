targetScope = 'resourceGroup'

@description('Short environment identifier used to derive resource names (letters and numbers only).')
param environmentName string = 'agenticpoc'

@description('Primary Azure location for the deployment.')
param location string = resourceGroup().location

@description('Azure location for the Azure OpenAI account (must be a region that supports Azure OpenAI).')
param openAiLocation string = 'eastus'

@description('Logical tags applied to every resource.')
param tags object = {
  project: 'AgenticWellArchitected'
  env: 'poc'
}

@description('Name assigned to the Azure OpenAI model deployment.')
param openAiDeploymentName string = 'agentic-gpt4o'

@description('Model identifier used for the Azure OpenAI deployment.')
param openAiModelName string = 'gpt-4o'

@description('Model version used for the Azure OpenAI deployment.')
param openAiModelVersion string = '2024-08-06'

@description('Token capacity for the model deployment (TPM - Tokens Per Minute).')
param deploymentCapacity int = 240

var sanitizedEnv = toLower(replace(environmentName, '-', ''))
var storagePrefix = '${sanitizedEnv}artifacts'
var openAiAccountName = substring('${sanitizedEnv}aoai${uniqueString(resourceGroup().id)}', 0, 24)
var workspaceName = '${sanitizedEnv}-mlw'

module storage 'modules/storage.bicep' = {
  name: 'storage${uniqueString(resourceGroup().id, storagePrefix)}'
  params: {
    namePrefix: storagePrefix
    location: location
    tags: tags
  }
}

module workspace 'modules/ai-workspace.bicep' = {
  name: 'workspace${uniqueString(resourceGroup().id, workspaceName)}'
  params: {
    workspaceName: workspaceName
    location: location
    friendlyName: '${environmentName}-agentic-waf'
    description: 'Agentic Well-Architected PoC workspace for running interview flows.'
    tags: tags
  }
}

module openAi 'modules/openai.bicep' = {
  name: 'openai${uniqueString(resourceGroup().id, openAiAccountName)}'
  params: {
    accountName: openAiAccountName
    location: openAiLocation
    tags: tags
    deploymentName: openAiDeploymentName
    modelName: openAiModelName
    modelVersion: openAiModelVersion
    deploymentCapacity: deploymentCapacity
  }
}

output artifactContainerUrl string = storage.outputs.containerUrl
output staticWebsiteUrl string = storage.outputs.staticWebsiteUrl
output storageAccountName string = storage.outputs.storageAccountName
output mlWorkspaceId string = workspace.outputs.workspaceId
output mlWorkspaceName string = workspace.outputs.workspaceName
output mlStudioUrl string = workspace.outputs.studioUrl
output openAiAccountName string = openAi.outputs.accountName
output openAiEndpoint string = openAi.outputs.endpoint
output openAiDeploymentName string = openAi.outputs.deploymentName
