@description('Namespace suffix to isolate resources in the same sandbox (e.g. team-a)')
param namespace string

@description('Azure region')
param location string = resourceGroup().location

@description('Backend container image (full ACR path)')
param backendImage string

@description('Frontend container image (full ACR path)')
param frontendImage string

@description('App secret key for backend')
@secure()
param secretKey string

@description('PostgreSQL admin username (letters/numbers only)')
param postgresAdminUsername string = 'triciaadmin'

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('PostgreSQL database name for the app')
param postgresDatabaseName string = 'tricia_monitoring'

@description('PostgreSQL flexible server SKU name')
param postgresSkuName string = 'Standard_B1ms'

@description('PostgreSQL flexible server SKU tier')
param postgresSkuTier string = 'Burstable'

@description('PostgreSQL storage size in GB')
param postgresStorageGb int = 32

@description('PostgreSQL major version')
param postgresVersion string = '16'

@description('Allowed CORS origins for backend (comma-separated)')
param corsOrigins string = ''

@description('Bootstrap admin username')
param bootstrapAdminUsername string = ''

@description('Bootstrap admin password')
@secure()
param bootstrapAdminPassword string = ''

@description('Bootstrap admin display name')
param bootstrapAdminDisplayName string = 'System Admin'

@description('Backend CPU')
param backendCpu string = '0.5'

@description('Backend memory')
param backendMemory string = '1Gi'

@description('Frontend CPU')
param frontendCpu string = '0.5'

@description('Frontend memory')
param frontendMemory string = '1Gi'

var appBase = 'tricia-${namespace}'
var acrName = replace('tricia${namespace}acr', '-', '')
var backendName = '${appBase}-backend'
var frontendName = '${appBase}-frontend'
var envName = '${appBase}-env'
var postgresServerName = take(toLower(replace('${appBase}-pg', '_', '-')), 63)

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appBase}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresServerName
  location: location
  sku: {
    name: postgresSkuName
    tier: postgresSkuTier
  }
  properties: {
    createMode: 'Create'
    version: postgresVersion
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: postgresStorageGb
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource postgresAllowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'allow-azure-services'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

var databaseUrl = 'postgresql+psycopg://${postgresAdminUsername}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${postgresDatabaseName}?sslmode=require'

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
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

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendName
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'secret-key'
          value: secretKey
        }
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'bootstrap-admin-password'
          value: bootstrapAdminPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json(backendCpu)
            memory: backendMemory
          }
          env: [
            {
              name: 'APP_ENV'
              value: 'production'
            }
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'SECRET_KEY'
              secretRef: 'secret-key'
            }
            {
              name: 'CORS_ORIGINS'
              value: corsOrigins
            }
            {
              name: 'BOOTSTRAP_ADMIN_USERNAME'
              value: bootstrapAdminUsername
            }
            {
              name: 'BOOTSTRAP_ADMIN_PASSWORD'
              secretRef: 'bootstrap-admin-password'
            }
            {
              name: 'BOOTSTRAP_ADMIN_DISPLAY_NAME'
              value: bootstrapAdminDisplayName
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: frontendName
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json(frontendCpu)
            memory: frontendMemory
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output backendFqdn string = backendApp.properties.configuration.ingress.fqdn
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn
output acrLoginServer string = acr.properties.loginServer
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
