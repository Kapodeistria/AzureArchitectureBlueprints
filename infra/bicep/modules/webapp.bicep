@description('Name for the App Service Plan')
param appServicePlanName string

@description('Name for the Web App')
param webAppName string

@description('Azure region for deployment')
param location string

@description('SKU for App Service Plan')
param sku object = {
  name: 'B1'
  tier: 'Basic'
  capacity: 1
}

@description('Runtime stack for the web app')
param linuxFxVersion string = 'NODE|20-lts'

@description('Environment variables for the web app')
param appSettings array = []

@description('Resource tags')
param tags object = {}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: sku
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
      http20Enabled: true
    }
  }
}

// App settings must be set as a separate resource
resource webAppSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  name: 'appsettings'
  parent: webApp
  properties: union(
    {
      SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
      WEBSITE_NODE_DEFAULT_VERSION: '20-lts'
    },
    reduce(appSettings, {}, (cur, next) => union(cur, { '${next.name}': next.value }))
  )
}

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppPrincipalId string = webApp.identity.principalId
output appServicePlanId string = appServicePlan.id