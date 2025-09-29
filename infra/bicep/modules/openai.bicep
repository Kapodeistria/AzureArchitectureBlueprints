@description('Name for the Azure OpenAI account (must be globally unique).')
param accountName string

@description('Azure region for the Azure OpenAI resource (e.g. eastus, swedencentral).')
param location string

@description('SKU used for the Azure OpenAI account.')
param skuName string = 'S0'

@description('Resource tags applied to the Azure OpenAI account.')
param tags object = {}

@description('Deployment name provisioned inside the Azure OpenAI account.')
param deploymentName string = 'gpt-4.1'

@description('Azure OpenAI model identifier to deploy (latest GPT-4 model).')
param modelName string = 'gpt-4.1'

@description('Model version to deploy.')
param modelVersion string = '2025-04-14'

@description('Model format for the deployment.')
@allowed([
  'OpenAI'
  'AzureOpenAI'
])
param modelFormat string = 'OpenAI'

@description('Token capacity for the model deployment (TPM - Tokens Per Minute). Increased from 60 to 240 for multi-agent workloads.')
param deploymentCapacity int = 240

resource account 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: accountName
  location: location
  kind: 'OpenAI'
  sku: {
    name: skuName
  }
  tags: tags
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
  }
}

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  name: '${account.name}/${deploymentName}'
  sku: {
    name: 'Standard'
    capacity: deploymentCapacity
  }
  properties: {
    model: {
      name: modelName
      version: modelVersion
      format: modelFormat
    }
  }
}

output accountName string = account.name
output resourceId string = account.id
output endpoint string = format('https://{0}.openai.azure.com/', account.properties.customSubDomainName)
output deploymentName string = deploymentName
output modelName string = modelName
