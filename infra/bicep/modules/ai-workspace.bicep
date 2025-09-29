@description('Name of the Azure Machine Learning workspace to create (3-32 characters).')
param workspaceName string

@description('Azure region where the workspace is deployed.')
param location string

@description('Friendly display name shown in the Azure Studio.')
param friendlyName string = workspaceName

@description('Optional description for the workspace.')
param description string = 'Agentic Well-Architected PoC workspace.'

@description('Resource tags applied to the workspace.')
param tags object = {}

@description('Set to false to disable public network access.')
param allowPublicNetworkAccess bool = true

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
    description: description
    publicNetworkAccess: allowPublicNetworkAccess ? 'Enabled' : 'Disabled'
  }
}

var studioHost = 'https://ml.azure.com/rp/workspaces'

output workspaceName string = workspace.name
output workspaceId string = workspace.id
output workspaceLocation string = workspace.location
output studioUrl string = format('{0}/{1}', studioHost, workspace.name)
