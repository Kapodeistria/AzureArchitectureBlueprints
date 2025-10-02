param name string
param location string
param sku string = 'standard'
param tenantId string
param enablePurgeProtection bool = true

resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: name
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: toUpper(sku)
    }
    enablePurgeProtection: enablePurgeProtection
    enableRbacAuthorization: true
    accessPolicies: []
    publicNetworkAccess: 'Enabled'
  }
}

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
