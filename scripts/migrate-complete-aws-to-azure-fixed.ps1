# ?? Script de Migration Compl?te AWS ? Azure (100% Automatique)
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

Write-Host "?? Migration Compl?te AWS ? Azure (100% Automatique)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre ? jour le PATH pour inclure Azure CLI
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# V?rifier Azure CLI
Write-Host "?? V?rification d'Azure CLI..." -ForegroundColor Yellow
$azCmd = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCmd) {
    $azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    if (Test-Path $azPath) {
        $env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
        $azCmd = Get-Command az -ErrorAction SilentlyContinue
    }
}

if (-not $azCmd) {
    Write-Host "? Azure CLI n'est pas install?" -ForegroundColor Red
    Write-Host "Installation..." -ForegroundColor Yellow
    winget install Microsoft.AzureCLI --silent
    Start-Sleep -Seconds 10
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# V?rifier AWS CLI
Write-Host "?? V?rification d'AWS CLI..." -ForegroundColor Yellow
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "??  AWS CLI non trouv? - Les variables d'environnement seront configur?es manuellement" -ForegroundColor Yellow
    $useAws = $false
} else {
    $useAws = $true
    Write-Host "? AWS CLI trouv?" -ForegroundColor Green
}

Write-Host ""

# Connexion Azure
Write-Host "?? Connexion ? Azure..." -ForegroundColor Yellow
$account = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "??  Non connect? ? Azure. Connexion..." -ForegroundColor Yellow
    Write-Host "   Un navigateur va s'ouvrir pour vous connecter..." -ForegroundColor Cyan
    & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login
    $account = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --output json | ConvertFrom-Json
}

Write-Host "? Connect? ? Azure" -ForegroundColor Green
Write-Host "   Subscription: $($account.name) ($($account.id))" -ForegroundColor Gray
Write-Host ""

# G?n?rer automatiquement les secrets
Write-Host "?? G?n?ration automatique des secrets..." -ForegroundColor Yellow
$DbPasswordPlain = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "? Secrets g?n?r?s automatiquement" -ForegroundColor Green
Write-Host ""

# R?cup?rer les variables d'environnement depuis AWS
Write-Host "?? R?cup?ration des variables d'environnement depuis AWS..." -ForegroundColor Yellow
$envVars = @{}

if ($useAws) {
    try {
        # R?cup?rer la Task Definition actuelle
        $taskDefArn = aws ecs describe-services `
            --cluster $AwsCluster `
            --services $AwsService `
            --region $AwsRegion `
            --query 'services[0].taskDefinition' `
            --output text 2>$null

        if ($taskDefArn) {
            Write-Host "   Task Definition trouv?e: $taskDefArn" -ForegroundColor Gray
            
            # R?cup?rer les variables d'environnement
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
                    Write-Host "   ? $($env.name)" -ForegroundColor Gray
                }
            }

            # Variables depuis Secrets Manager / SSM
            if ($containerDef.secrets) {
                foreach ($secret in $containerDef.secrets) {
                    $secretName = $secret.name
                    $secretValueFrom = $secret.valueFrom
                    
                    # Essayer de r?cup?rer depuis SSM Parameter Store
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
                                Write-Host "   ? $secretName (depuis SSM)" -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "   ??  $secretName (non r?cup?r? depuis SSM)" -ForegroundColor Yellow
                        }
                    }
                    
                    # Essayer de r?cup?rer depuis Secrets Manager
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
                                Write-Host "   ? $secretName (depuis Secrets Manager)" -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "   ??  $secretName (non r?cup?r? depuis Secrets Manager)" -ForegroundColor Yellow
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "   ??  Impossible de r?cup?rer depuis AWS: $_" -ForegroundColor Yellow
    }
}

# Variables essentielles par d?faut (si non trouv?es dans AWS)
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

# Mettre ? jour JWT_SECRET si g?n?r?
if (-not $envVars.ContainsKey("JWT_SECRET") -or [string]::IsNullOrEmpty($envVars["JWT_SECRET"])) {
    $envVars["JWT_SECRET"] = $JwtSecret
}

Write-Host "? Variables d'environnement r?cup?r?es: $($envVars.Count)" -ForegroundColor Green
Write-Host ""

# Cr?er le Resource Group
Write-Host "?? Cr?ation du Resource Group..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" group create `
    --name $ResourceGroupName `
    --location $Location `
    --output none

Write-Host "? Resource Group cr??: $ResourceGroupName" -ForegroundColor Green
Write-Host ""

# Cr?er la base de donn?es PostgreSQL
Write-Host "???  Cr?ation de la base de donn?es PostgreSQL..." -ForegroundColor Yellow
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

Write-Host "? Base de donn?es PostgreSQL cr??e: $DbName" -ForegroundColor Green
Write-Host ""

# Installer les extensions PostgreSQL (via Azure Cloud Shell ou attendre les migrations)
Write-Host "?? Les extensions PostgreSQL seront install?es automatiquement via les migrations" -ForegroundColor Yellow
Write-Host ""

# Cr?er App Service Plan
Write-Host "?? Cr?ation de l'App Service Plan..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" appservice plan create `
    --name $AppServicePlanName `
    --resource-group $ResourceGroupName `
    --location $Location `
    --sku $PricingTier `
    --is-linux `
    --output none

Write-Host "? App Service Plan cr??: $AppServicePlanName (SKU: $PricingTier)" -ForegroundColor Green
Write-Host ""

# Cr?er App Service (Web App)
Write-Host "?? Cr?ation de l'App Service (Backend)..." -ForegroundColor Yellow
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp create `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --plan $AppServicePlanName `
    --deployment-container-image-name $DockerImage `
    --output none

Write-Host "? App Service cr??: $AppServiceName" -ForegroundColor Green
Write-Host ""

# Construire la cha?ne DATABASE_URL
$DbFqdn = "$DbName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:$DbPasswordPlain@${DbFqdn}:5432/postgres?sslmode=require"

# Mettre ? jour DATABASE_URL dans les variables
$envVars["DATABASE_URL"] = $DatabaseUrl

# Configurer les variables d'environnement
Write-Host "??  Configuration des variables d'environnement..." -ForegroundColor Yellow

# Construire la commande avec toutes les variables
$settingsArray = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    # ?chapper les caract?res sp?ciaux pour PowerShell
    $value = $value -replace '"', '\"'
    $settingsArray += "${key}=$value"
}

# Utiliser --settings avec format key=value
$settingsString = $settingsArray -join " "

& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --settings $settingsString `
    --output none

Write-Host "? Variables d'environnement configur?es ($($envVars.Count) variables)" -ForegroundColor Green
Write-Host ""

# Configurer le health check
Write-Host "?? Configuration du health check..." -ForegroundColor Yellow
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

Write-Host "? Health check configur?" -ForegroundColor Green
Write-Host ""

# Obtenir l'URL de l'App Service
$AppServiceUrl = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp show `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --query defaultHostName `
    --output tsv

Write-Host ""
Write-Host "? Migration compl?te termin?e avec succ?s !" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "?? Informations importantes:" -ForegroundColor Cyan
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "   Database: $DbFqdn" -ForegroundColor White
Write-Host "   Database User: $DbAdminUser" -ForegroundColor White
Write-Host "   App Service: $AppServiceName" -ForegroundColor White
Write-Host "   App Service URL: https://$AppServiceUrl" -ForegroundColor White
Write-Host ""
Write-Host "?? Secrets g?n?r?s (SAUVEGARDEZ CES INFORMATIONS):" -ForegroundColor Yellow
Write-Host "   Database Password: $DbPasswordPlain" -ForegroundColor Red
Write-Host "   JWT_SECRET: $JwtSecret" -ForegroundColor Red
Write-Host ""
Write-Host "?? Variables d'environnement configur?es:" -ForegroundColor Cyan
Write-Host "   Total: $($envVars.Count) variables" -ForegroundColor White
foreach ($key in $envVars.Keys | Sort-Object) {
    $value = $envVars[$key]
    if ($value.Length -gt 50) {
        $value = $value.Substring(0, 50) + "..."
    }
    Write-Host "   - $key = $value" -ForegroundColor Gray
}
Write-Host ""
Write-Host "?? Prochaines ?tapes:" -ForegroundColor Cyan
Write-Host "   1. Mettre ? jour DNS Cloudflare:" -ForegroundColor White
Write-Host "      Type: CNAME" -ForegroundColor Gray
Write-Host "      Name: api" -ForegroundColor Gray
Write-Host "      Target: $AppServiceUrl" -ForegroundColor Gray
Write-Host "      Proxy: Activ? (nuage orange)" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Attendre 2-3 minutes pour le d?marrage du backend" -ForegroundColor White
Write-Host ""
Write-Host "   3. Tester le backend:" -ForegroundColor White
Write-Host "      curl https://api.yukpomnang.com/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Les migrations s'ex?cuteront automatiquement (ENABLE_AUTO_MIGRATIONS=true)" -ForegroundColor White
Write-Host "      - Tables cr??es automatiquement" -ForegroundColor Gray
Write-Host "      - Indexes cr??s automatiquement" -ForegroundColor Gray
Write-Host "      - Fonctions cr??es automatiquement" -ForegroundColor Gray
Write-Host ""
Write-Host "??  IMPORTANT: Sauvegardez les secrets dans un endroit s?r !" -ForegroundColor Red
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

Write-Host "? Script termin? !" -ForegroundColor Green


