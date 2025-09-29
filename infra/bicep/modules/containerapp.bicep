@description('Container App Environment name')
param environmentName string

@description('Container App name')
param containerAppName string

@description('Location for resources')
param location string = resourceGroup().location

@description('Tags to apply to resources')
param tags object = {}

@description('Container image')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Service Bus connection string')
@secure()
param serviceBusConnectionString string

@description('Azure OpenAI endpoint')
param openAiEndpoint string

@description('Azure OpenAI deployment name')
param openAiDeploymentName string

@description('Storage account name')
param storageAccountName string

@description('ML Workspace name')
param mlWorkspaceName string

@description('Enable Managed Identity')
param enableManagedIdentity bool = true

@description('Azure Container Registry server (optional - leave empty if using public images)')
param acrServer string = ''

// Container Apps Environment
resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${environmentName}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container App for Agent Worker
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: enableManagedIdentity ? {
    type: 'SystemAssigned'
  } : null
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      secrets: [
        {
          name: 'servicebus-connection'
          value: serviceBusConnectionString
        }
      ]
      registries: !empty(acrServer) ? [
        {
          server: acrServer
          identity: 'system'
        }
      ] : []
      activeRevisionsMode: 'Single'
      ingress: null // No external ingress - this is a background worker
    }
    template: {
      containers: [
        {
          name: 'agent-worker'
          image: containerImage
          resources: {
            cpu: json('2.0')
            memory: '4Gi'
          }
          env: [
            {
              name: 'SERVICE_BUS_CONNECTION'
              secretRef: 'servicebus-connection'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: openAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
              value: openAiDeploymentName
            }
            {
              name: 'STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'AZURE_ML_WORKSPACE_NAME'
              value: mlWorkspaceName
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 5
        rules: [
          {
            name: 'queue-scaling'
            custom: {
              type: 'azure-servicebus'
              metadata: {
                queueName: 'casestudy-jobs'
                messageCount: '1'
              }
              auth: [
                {
                  secretRef: 'servicebus-connection'
                  triggerParameter: 'connection'
                }
              ]
            }
          }
        ]
      }
    }
  }
}

output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
output principalId string = enableManagedIdentity ? containerApp.identity.principalId : ''
output environmentId string = environment.id