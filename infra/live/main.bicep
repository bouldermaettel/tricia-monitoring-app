@description('Deployment target. The resource names are derived from this value.')
@allowed([
  'prod'
  'dev'
])
param environment string

@description('Azure region used for validation and outputs.')
param location string = resourceGroup().location

@description('Pinned backend image, including registry and tag.')
param backendImage string

@description('Pinned frontend image, including registry and tag.')
param frontendImage string

@description('Complete PostgreSQL SQLAlchemy connection string for this environment.')
@secure()
param databaseUrl string

@description('JWT/application secret for this environment.')
@secure()
param secretKey string

@description('Bootstrap administrator username for this environment.')
param bootstrapAdminUsername string

@description('Bootstrap administrator password for this environment.')
@secure()
param bootstrapAdminPassword string

@description('Bootstrap administrator display name.')
param bootstrapAdminDisplayName string = 'Tricia Admin'

@description('Allowed frontend origin for the backend.')
param corsOrigins string

@description('Backend origin consumed by the frontend.')
param backendApiOrigin string

@description('Value used to force a new revision when configuration or image inputs change.')
param deployTimestamp string = ''

@description('Existing shared Azure Container Registry.')
param acrName string = 'triciamonitoringacr'

var appBase = environment == 'prod' ? 'tricia-monitoring' : 'tricia-monitoring-dev'
var backendName = '${appBase}-backend'
var frontendName = '${appBase}-frontend'
var managedEnvironmentName = '${appBase}-env'
var postgresName = '${appBase}-pg'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: managedEnvironmentName
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' existing = {
  name: postgresName
}

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendName
  location: location
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
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
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'secret-key'
          value: secretKey
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
            cpu: json('0.5')
            memory: '1Gi'
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
            {
              name: 'DEPLOY_TIMESTAMP'
              value: deployTimestamp
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
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
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
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'BACKEND_API_ORIGIN'
              value: backendApiOrigin
            }
            {
              name: 'DEPLOY_TIMESTAMP'
              value: deployTimestamp
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

output backendFqdn string = backendApp.properties.configuration.ingress.fqdn
output frontendFqdn string = frontendApp.properties.configuration.ingress.fqdn
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
