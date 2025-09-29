@description('Prefix used to derive the storage account name (letters and numbers only).')
param namePrefix string

@description('Primary Azure region for the storage account.')
param location string

@description('Name of the public blob container that exposes generated case study artefacts.')
param publicContainerName string = 'final-artifacts'

@description('Enable static website hosting on the storage account.')
param enableStaticWebsite bool = true

@description('Default document served when static website hosting is enabled.')
param indexDocument string = 'index.html'

@description('Path to the error document served for 404 responses when static website hosting is enabled.')
param errorDocument string = '404.html'

@description('Resource tags applied to the storage account.')
param tags object = {}

var sanitizedPrefix = toLower(replace(namePrefix, '-', ''))
var storageAccountName = substring(format('{0}{1}', sanitizedPrefix, uniqueString(resourceGroup().id, namePrefix)), 0, 24)

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_ZRS' // Upgraded from LRS to ZRS for better resilience
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: true // Required for Azure Functions storage mounting
    defaultToOAuthAuthentication: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    restorePolicy: {
      enabled: false
    }
    isVersioningEnabled: false
    changeFeed: {
      enabled: false
    }
    containerDeleteRetentionPolicy: {
      enabled: false
    }
  }
}

// Enable static website hosting (requires post-storage creation)
resource staticWebsite 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = if (enableStaticWebsite) {
  parent: blobService
  name: '$web'
  properties: {
    publicAccess: 'Blob'
  }
}

resource artifactContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: publicContainerName
  properties: {
    publicAccess: 'Blob'
  }
}

output storageAccountName string = storage.name
output resourceId string = storage.id
output containerName string = publicContainerName
output primaryEndpoints object = storage.properties.primaryEndpoints
output containerUrl string = '${storage.properties.primaryEndpoints.blob}${publicContainerName}'
output staticWebsiteUrl string = enableStaticWebsite ? storage.properties.primaryEndpoints.web : '${storage.properties.primaryEndpoints.blob}$web/'
