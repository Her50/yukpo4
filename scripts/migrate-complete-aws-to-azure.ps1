# 🚀 Script de Migration Complète AWS → Azure (100% Automatique)
# Usage: .\scripts\migrate-complete-aws-to-azure.ps1

param(
    [string]$ResourceGroupName = "yukpomnang-rg",
    [string]$Location = "westeurope",
    [string]$DbName = "yukpomnang-db",
    [string]$DbAdminUser = "yukpo_admin",
    [string]$AppServiceName = "yukpo-backend",
    [string]$AppServicePlanName = "yukpo-backend-plan",
    [string]$DockerImage = "ghcr.io/Her50/yukpo4/yukpomnang-backend-optimized:latest",
    [string]$PricingTier = "F1",  # F1 = Free, B1 = Basic (~$13/mois)
    [string]$AwsCluster = "yukpo-cluster",
    [string]$AwsService = "yukpo-backend-service",
    [string]$AwsRegion = "eu-west-1"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Migration Complète AWS → Azure (100% Automatique)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre à jour le PATH pour inclure Azure CLI
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Vérifier Azure CLI
Write-Host "📋 Vérification d'Azure CLI..." -ForegroundColor Yellow
$azCmd = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCmd) {
    $azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    if (Test-Path $azPath) {
        $env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
        $azCmd = Get-Command az -ErrorAction SilentlyContinue
    }
}

if (-not $azCmd) {
    Write-Host "❌ Azure CLI n'est pas installé" -ForegroundColor Red
    Write-Host "Installation..." -ForegroundColor Yellow
    winget install Microsoft.AzureCLI --silent
    Start-Sleep -Seconds 10
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Vérifier AWS CLI
Write-Host "📋 Vérification d'AWS CLI..." -ForegroundColor Yellow
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  AWS CLI non trouvé - Les variables d'environnement seront configurées manuellement" -ForegroundColor Yellow
    $useAws = $false
} else {
    $useAws = $true
    Write-Host "✅ AWS CLI trouvé" -ForegroundColor Green
}

Write-Host ""

# Connexion Azure
Write-Host "📋 Connexion à Azure..." -ForegroundColor Yellow
$account = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "⚠️  Non connecté à Azure. Connexion..." -ForegroundColor Yellow
    Write-Host "   Un navigateur va s'ouvrir pour vous connecter..." -ForegroundColor Cyan
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login
    $account = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --output json | ConvertFrom-Json
}

Write-Host "✅ Connecté à Azure" -ForegroundColor Green
Write-Host "   Subscription: $($account.name) ($($account.id))" -ForegroundColor Gray
Write-Host ""

# Générer automatiquement les secrets
Write-Host "🔐 Génération automatique des secrets..." -ForegroundColor Yellow
$DbPasswordPlain = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "✅ Secrets générés automatiquement" -ForegroundColor Green
Write-Host ""

# Récupérer les variables d'environnement depuis AWS
Write-Host "📥 Récupération des variables d'environnement depuis AWS..." -ForegroundColor Yellow
$envVars = @{}

if ($useAws) {
    try {
        # Récupérer la Task Definition actuelle
        $taskDefArn = aws ecs describe-services `
            --cluster $AwsCluster `
            --services $AwsService `
            --region $AwsRegion `
            --query 'services[0].taskDefinition' `
            --output text 2>$null

        if ($taskDefArn) {
            Write-Host "   Task Definition trouvée: $taskDefArn" -ForegroundColor Gray
            
            # Récupérer les variables d'environnement
            $taskDef = aws ecs describe-task-definition `
                --task-definition $taskDefArn `
                --region $AwsRegion `
                --output json | ConvertFrom-Json

            # Extraire les variables d'environnement
            $containerDef = $taskDef.taskDefinition.containerDefinitions[0]
            
            # Variables directes
            if ($containerDef.environment) {
                foreach ($env in $containerDef.environment) {
                    $envVars[$env.name] = $env.value
                    Write-Host "   ✅ $($env.name)" -ForegroundColor Gray
                }
            }

            # Variables depuis Secrets Manager / SSM
            if ($containerDef.secrets) {
                foreach ($secret in $containerDef.secrets) {
                    $secretName = $secret.name
                    $secretValueFrom = $secret.valueFrom
                    
                    # Essayer de récupérer depuis SSM Parameter Store
                    if ($secretValueFrom -like "*ssm*") {
                        $paramName = $secretValueFrom -replace "arn:aws:ssm:.*:parameter:", ""
                        try {
                            $paramValue = aws ssm get-parameter `
                                --name $paramName `
                                --region $AwsRegion `
                                --with-decryption `
                                --query 'Parameter.Value' `
                                --output text 2>$null
                            if ($paramValue) {
                                $envVars[$secretName] = $paramValue
                                Write-Host "   ✅ $secretName (depuis SSM)" -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "   ⚠️  $secretName (non récupéré depuis SSM)" -ForegroundColor Yellow
                        }
                    }
                    
                    # Essayer de récupérer depuis Secrets Manager
                    if ($secretValueFrom -like "*secretsmanager*") {
                        $secretArn = $secretValueFrom -replace "arn:aws:secretsmanager:.*:secret:", ""
                        $secretArn = $secretArn -replace "/.*", ""
                        try {
                            $secretValue = aws secretsmanager get-secret-value `
                                --secret-id $secretArn `
                                --region $AwsRegion `
                                --query 'SecretString' `
                                --output text 2>$null
                            if ($secretValue) {
                                # Si c'est du JSON, parser
                                try {
                                    $secretJson = $secretValue | ConvertFrom-Json
                                    foreach ($key in $secretJson.PSObject.Properties.Name) {
                                        $envVars[$key] = $secretJson.$key
                                    }
                                } catch {
                                    $envVars[$secretName] = $secretValue
                                }
                                Write-Host "   ✅ $secretName (depuis Secrets Manager)" -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "   ⚠️  $secretName (non récupéré depuis Secrets Manager)" -ForegroundColor Yellow
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "   ⚠️  Impossible de récupérer depuis AWS: $_" -ForegroundColor Yellow
    }
}

# Variables essentielles par défaut (si non trouvées dans AWS)
if (-not $envVars.ContainsKey("ENABLE_AUTO_MIGRATIONS")) {
    $envVars["ENABLE_AUTO_MIGRATIONS"] = "true"
}
if (-not $envVars.ContainsKey("SQLX_OFFLINE")) {
    $envVars["SQLX_OFFLINE"] = "true"
}
if (-not $envVars.ContainsKey("RUST_LOG")) {
    $envVars["RUST_LOG"] = "info"
}
if (-not $envVars.ContainsKey("ENVIRONMENT")) {
    $envVars["ENVIRONMENT"] = "production"
}
if (-not $envVars.ContainsKey("ALLOWED_ORIGINS")) {
    $envVars["ALLOWED_ORIGINS"] = "https://api.yukpomnang.com,https://yukpomnang.com"
}

# Mettre à jour JWT_SECRET si généré
if (-not $envVars.ContainsKey("JWT_SECRET") -or [string]::IsNullOrEmpty($envVars["JWT_SECRET"])) {
    $envVars["JWT_SECRET"] = $JwtSecret
}

Write-Host "✅ Variables d'environnement récupérées: $($envVars.Count)" -ForegroundColor Green
Write-Host ""

# Créer le Resource Group
Write-Host "📦 Création du Resource Group..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" group create `
    --name $ResourceGroupName `
    --location $Location `
    --output none

Write-Host "✅ Resource Group créé: $ResourceGroupName" -ForegroundColor Green
Write-Host ""

# Créer la base de données PostgreSQL
Write-Host "🗄️  Création de la base de données PostgreSQL..." -ForegroundColor Yellow
Write-Host "   (Cela peut prendre 3-5 minutes...)" -ForegroundColor Gray

& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" postgres flexible-server create `
    --resource-group $ResourceGroupName `
    --name $DbName `
    --location $Location `
    --admin-user $DbAdminUser `
    --admin-password $DbPasswordPlain `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --version 15 `
    --storage-size 32 `
    --public-access 0.0.0.0 `
    --output none

Write-Host "✅ Base de données PostgreSQL créée: $DbName" -ForegroundColor Green
Write-Host ""

# Installer les extensions PostgreSQL (via Azure Cloud Shell ou attendre les migrations)
Write-Host "🔌 Les extensions PostgreSQL seront installées automatiquement via les migrations" -ForegroundColor Yellow
Write-Host ""

# Créer App Service Plan
Write-Host "📋 Création de l'App Service Plan..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" appservice plan create `
    --name $AppServicePlanName `
    --resource-group $ResourceGroupName `
    --location $Location `
    --sku $PricingTier `
    --is-linux `
    --output none

Write-Host "✅ App Service Plan créé: $AppServicePlanName (SKU: $PricingTier)" -ForegroundColor Green
Write-Host ""

# Créer App Service (Web App)
Write-Host "🚀 Création de l'App Service (Backend)..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp create `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --plan $AppServicePlanName `
    --deployment-container-image-name $DockerImage `
    --output none

Write-Host "✅ App Service créé: $AppServiceName" -ForegroundColor Green
Write-Host ""

# Construire la chaîne DATABASE_URL
$DbFqdn = "$DbName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:$DbPasswordPlain@${DbFqdn}:5432/postgres?sslmode=require"

# Mettre à jour DATABASE_URL dans les variables
$envVars["DATABASE_URL"] = $DatabaseUrl

# Configurer les variables d'environnement
Write-Host "Configuration des variables d'environnement..." -ForegroundColor Yellow

# Construire la commande avec toutes les variables (format JSON pour Azure CLI)
$settingsJson = @{}
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    $settingsJson[$key] = $value
}

# Convertir en JSON et sauvegarder temporairement
$tempJsonFile = [System.IO.Path]::GetTempFileName() + ".json"
$settingsJson | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempJsonFile -Encoding UTF8

# Utiliser --settings avec fichier JSON
$settingsArgs = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    # Échapper les guillemets et caractères spéciaux
    $value = $value -replace '"', '`"'
    $value = $value -replace '\$', '`$'
    $settingsArgs += "$key=`"$value`""
}

# Utiliser --settings avec chaque variable individuellement
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --settings $settingsArgs `
    --output none

Write-Host "✅ Variables d'environnement configurées ($($envVars.Count) variables)" -ForegroundColor Green
Write-Host ""

# Configurer le health check
Write-Host "🏥 Configuration du health check..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --always-on true `
    --output none

# Configurer le health check path
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --generic-configurations '{"healthCheckPath": "/healthz"}' `
    --output none 2>$null

Write-Host "✅ Health check configuré" -ForegroundColor Green
Write-Host ""

# Obtenir l'URL de l'App Service
$AppServiceUrl = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp show `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --query defaultHostName `
    --output tsv

Write-Host ""
Write-Host "✅ Migration complète terminée avec succès !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Informations importantes:" -ForegroundColor Cyan
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "   Database: $DbFqdn" -ForegroundColor White
Write-Host "   Database User: $DbAdminUser" -ForegroundColor White
Write-Host "   App Service: $AppServiceName" -ForegroundColor White
Write-Host "   App Service URL: https://$AppServiceUrl" -ForegroundColor White
Write-Host ""
Write-Host "🔐 Secrets générés (SAUVEGARDEZ CES INFORMATIONS):" -ForegroundColor Yellow
Write-Host "   Database Password: $DbPasswordPlain" -ForegroundColor Red
Write-Host "   JWT_SECRET: $JwtSecret" -ForegroundColor Red
Write-Host ""
Write-Host "📊 Variables d'environnement configurées:" -ForegroundColor Cyan
Write-Host "   Total: $($envVars.Count) variables" -ForegroundColor White
foreach ($key in $envVars.Keys | Sort-Object) {
    $value = $envVars[$key]
    if ($value.Length -gt 50) {
        $value = $value.Substring(0, 50) + "..."
    }
    Write-Host "   - $key = $value" -ForegroundColor Gray
}
Write-Host ""
Write-Host "🌐 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Mettre à jour DNS Cloudflare:" -ForegroundColor White
Write-Host "      Type: CNAME" -ForegroundColor Gray
Write-Host "      Name: api" -ForegroundColor Gray
Write-Host "      Target: $AppServiceUrl" -ForegroundColor Gray
Write-Host "      Proxy: Activé (nuage orange)" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Attendre 2-3 minutes pour le démarrage du backend" -ForegroundColor White
Write-Host ""
Write-Host "   3. Tester le backend:" -ForegroundColor White
Write-Host "      curl https://api.yukpomnang.com/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Les migrations s'exécuteront automatiquement (ENABLE_AUTO_MIGRATIONS=true)" -ForegroundColor White
Write-Host "      - Tables créées automatiquement" -ForegroundColor Gray
Write-Host "      - Indexes créés automatiquement" -ForegroundColor Gray
Write-Host "      - Fonctions créées automatiquement" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT: Sauvegardez les secrets dans un endroit sûr !" -ForegroundColor Red
Write-Host ""

# Sauvegarder les secrets dans un fichier
$secretsFile = "azure-secrets-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
@"
Azure Migration Secrets - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
========================================

Database:
  Host: $DbFqdn
  User: $DbAdminUser
  Password: $DbPasswordPlain

JWT Secret:
  $JwtSecret

App Service:
  Name: $AppServiceName
  URL: https://$AppServiceUrl

Resource Group: $ResourceGroupName
"@ | Out-File -FilePath $secretsFile -Encoding UTF8

Write-Host "Secrets sauvegardes dans: $secretsFile" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Script terminé !" -ForegroundColor Green

