@description('Service Bus namespace name')
param namespaceName string

@description('Location for the Service Bus namespace')
param location string = resourceGroup().location

@description('Tags to apply to resources')
param tags object = {}

@description('Service Bus SKU')
@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Standard'

// Service Bus Namespace
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: namespaceName
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    minimumTlsVersion: '1.2'
  }
}

// Queue for case study processing jobs
resource jobQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'casestudy-jobs'
  properties: {
    maxDeliveryCount: 3
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P1D'
    deadLetteringOnMessageExpiration: true
    requiresDuplicateDetection: false
    enableBatchedOperations: true
    enablePartitioning: false
  }
}

// Queue for job status updates
resource statusQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'casestudy-status'
  properties: {
    maxDeliveryCount: 3
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P1D'
    deadLetteringOnMessageExpiration: false
    requiresDuplicateDetection: false
    enableBatchedOperations: true
    enablePartitioning: false
  }
}

output namespaceId string = serviceBusNamespace.id
output namespaceName string = serviceBusNamespace.name
output endpoint string = serviceBusNamespace.properties.serviceBusEndpoint
output jobQueueName string = jobQueue.name
output statusQueueName string = statusQueue.name