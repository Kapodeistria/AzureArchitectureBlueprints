@description('Name of the Azure Machine Learning workspace to create (3-32 characters).')
param workspaceName string

@description('Azure region where the workspace is deployed.')
param location string

@description('Friendly display name shown in the Azure Studio.')
param friendlyName string = workspaceName

@description('Optional description for the workspace.')
param workspaceDescription string = 'Agentic Well-Architected PoC workspace.'

@description('Resource tags applied to the workspace.')
param tags object = {}

@description('Set to false to disable public network access.')
param allowPublicNetworkAccess bool = true

// Storage account for workspace (max 15 chars for prefix)
var storageAccountName = 'ws${uniqueString(resourceGroup().id, workspaceName)}'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Key Vault for workspace (max 16 chars for prefix)
var keyVaultName = 'kv${uniqueString(resourceGroup().id, workspaceName)}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
    enableSoftDelete: true
  }
}

// Application Insights for workspace
var appInsightsName = 'ai-${workspaceName}'

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
  }
}

resource workspace 'Microsoft.MachineLearningServices/workspaces@2024-04-01' = {
  name: workspaceName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Basic'
  }
  properties: {
    friendlyName: friendlyName
    description: workspaceDescription
    publicNetworkAccess: allowPublicNetworkAccess ? 'Enabled' : 'Disabled'
    storageAccount: storage.id
    keyVault: keyVault.id
    applicationInsights: appInsights.id
  }
}

var studioHost = 'https://ml.azure.com/rp/workspaces'

output workspaceName string = workspace.name
output workspaceId string = workspace.id
output workspaceLocation string = workspace.location
output studioUrl string = format('{0}/{1}', studioHost, workspace.name)
