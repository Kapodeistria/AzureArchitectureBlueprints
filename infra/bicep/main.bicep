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
param openAiDeploymentName string = 'gpt-4.1'

@description('Model identifier used for the Azure OpenAI deployment.')
param openAiModelName string = 'gpt-4.1'

@description('Model version used for the Azure OpenAI deployment (latest GPT-4 model).')
param openAiModelVersion string = '2025-04-14'

@description('Token capacity for the model deployment (TPM - Tokens Per Minute).')
param deploymentCapacity int = 240

@description('Use existing Azure OpenAI resource instead of creating new one')
param useExistingOpenAI bool = true

@description('Existing Azure OpenAI resource name (if useExistingOpenAI is true)')
param existingOpenAIAccountName string = 'kapodeistria-1337-resource'

@description('Existing Azure OpenAI deployment name (if useExistingOpenAI is true)')
param existingOpenAIDeploymentName string = 'kapodeistria-1337'

@description('Existing Azure OpenAI resource group (if different from current)')
param existingOpenAIResourceGroup string = resourceGroup().name

var sanitizedEnv = toLower(replace(environmentName, '-', ''))
var storagePrefix = '${sanitizedEnv}artifacts'
var openAiAccountName = useExistingOpenAI ? existingOpenAIAccountName : substring('${sanitizedEnv}aoai${uniqueString(resourceGroup().id)}', 0, 24)
var workspaceName = '${sanitizedEnv}-mlw'
var webAppName = '${sanitizedEnv}-webapp'
var appServicePlanName = '${sanitizedEnv}-asp'
var serviceBusNamespace = '${sanitizedEnv}-sb-${uniqueString(resourceGroup().id)}'

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
    workspaceDescription: 'Agentic Well-Architected PoC workspace for running interview flows.'
    tags: tags
  }
}

module openAi 'modules/openai.bicep' = if (!useExistingOpenAI) {
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

// Get existing OpenAI resource if using existing
resource existingOpenAI 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' existing = if (useExistingOpenAI) {
  name: existingOpenAIAccountName
  scope: resourceGroup(existingOpenAIResourceGroup)
}

module serviceBus 'modules/servicebus.bicep' = {
  name: 'servicebus${uniqueString(resourceGroup().id, serviceBusNamespace)}'
  params: {
    namespaceName: serviceBusNamespace
    location: location
    tags: tags
    sku: 'Standard'
  }
}

// Function App for job processing
module functionApp 'modules/functionapp.bicep' = {
  name: 'functionapp${uniqueString(resourceGroup().id, '${sanitizedEnv}-func')}'
  params: {
    functionAppName: '${sanitizedEnv}-func'
    location: location
    tags: tags
    serviceBusConnectionString: listKeys(resourceId('Microsoft.ServiceBus/namespaces/authorizationRules', serviceBusNamespace, 'RootManageSharedAccessKey'), '2022-10-01-preview').primaryConnectionString
    storageAccountName: storage.outputs.storageAccountName
  }
  dependsOn: [serviceBus, storage]
}

// Reference to Service Bus namespace for role assignments
resource serviceBusNamespaceResource 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' existing = {
  name: serviceBusNamespace
}

// Role assignments for managed identities
// Azure Service Bus Data Receiver role for Function App
resource functionServiceBusDataReceiver 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespaceResource.id, '${sanitizedEnv}-func', 'ServiceBusDataReceiver')
  scope: serviceBusNamespaceResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0') // Service Bus Data Receiver
    principalId: functionApp.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

// Azure Service Bus Data Sender role for Function App
resource functionServiceBusDataSender 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespaceResource.id, '${sanitizedEnv}-func', 'ServiceBusDataSender')
  scope: serviceBusNamespaceResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39') // Service Bus Data Sender
    principalId: functionApp.outputs.principalId
    principalType: 'ServicePrincipal'
  }
}

// Azure Service Bus Data Sender role for Web App
resource webAppServiceBusDataSender 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespaceResource.id, webAppName, 'ServiceBusDataSender')
  scope: serviceBusNamespaceResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39') // Service Bus Data Sender
    principalId: webApp.outputs.webAppPrincipalId
    principalType: 'ServicePrincipal'
  }
}

module webApp 'modules/webapp.bicep' = {
  name: 'webapp${uniqueString(resourceGroup().id, webAppName)}'
  params: {
    appServicePlanName: appServicePlanName
    webAppName: webAppName
    location: location
    tags: tags
    appSettings: [
      {
        name: 'AZURE_OPENAI_ENDPOINT'
        value: useExistingOpenAI ? existingOpenAI.properties.endpoint : openAi.outputs.endpoint
      }
      {
        name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
        value: useExistingOpenAI ? existingOpenAIDeploymentName : openAi.outputs.deploymentName
      }
      {
        name: 'AZURE_ML_WORKSPACE_NAME'
        value: workspace.outputs.workspaceName
      }
      {
        name: 'STORAGE_ACCOUNT_NAME'
        value: storage.outputs.storageAccountName
      }
      {
        name: 'ARTIFACT_CONTAINER_URL'
        value: storage.outputs.containerUrl
      }
      {
        name: 'NODE_ENV'
        value: 'production'
      }
      {
        name: 'SERVICE_BUS_NAMESPACE'
        value: '${serviceBusNamespace}.servicebus.windows.net'
      }
      {
        name: 'SERVICE_BUS_CONNECTION__fullyQualifiedNamespace'
        value: '${serviceBusNamespace}.servicebus.windows.net'
      }
      {
        name: 'SERVICE_BUS_JOB_QUEUE'
        value: serviceBus.outputs.jobQueueName
      }
      {
        name: 'SERVICE_BUS_STATUS_QUEUE'
        value: serviceBus.outputs.statusQueueName
      }
    ]
  }
  dependsOn: [serviceBus]
}

output artifactContainerUrl string = storage.outputs.containerUrl
output staticWebsiteUrl string = storage.outputs.staticWebsiteUrl
output storageAccountName string = storage.outputs.storageAccountName
output mlWorkspaceId string = workspace.outputs.workspaceId
output mlWorkspaceName string = workspace.outputs.workspaceName
output mlStudioUrl string = workspace.outputs.studioUrl
output openAiAccountName string = useExistingOpenAI ? existingOpenAIAccountName : openAi.outputs.accountName
output openAiEndpoint string = useExistingOpenAI ? existingOpenAI.properties.endpoint : openAi.outputs.endpoint
output openAiDeploymentName string = useExistingOpenAI ? existingOpenAIDeploymentName : openAi.outputs.deploymentName
output webAppUrl string = webApp.outputs.webAppUrl
output webAppName string = webApp.outputs.webAppName
output serviceBusNamespace string = serviceBus.outputs.namespaceName
output jobQueueName string = serviceBus.outputs.jobQueueName
output statusQueueName string = serviceBus.outputs.statusQueueName
output functionAppName string = functionApp.outputs.functionAppName
output functionAppUrl string = functionApp.outputs.functionAppUrl
