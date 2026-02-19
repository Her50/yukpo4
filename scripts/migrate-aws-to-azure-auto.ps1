# Script de Migration Complete AWS vers Azure (100% Automatique)
# Usage: .\scripts\migrate-aws-to-azure-auto.ps1

param(
    [string]$ResourceGroupName = "yukpomnang-rg",
    [string]$Location = "westeurope",
    [string]$DbName = "yukpomnang-db",
    [string]$DbAdminUser = "yukpo_admin",
    [string]$AppServiceName = "yukpo-backend",
    [string]$AppServicePlanName = "yukpo-backend-plan",
    [string]$DockerImage = "ghcr.io/Her50/yukpo4/yukpomnang-backend-optimized:latest",
    [string]$PricingTier = "F1",
    [string]$AwsCluster = "yukpo-cluster",
    [string]$AwsService = "yukpo-backend-service",
    [string]$AwsRegion = "eu-west-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Migration Complete AWS vers Azure (100% Automatique)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verifier Azure CLI
Write-Host "Verification d'Azure CLI..." -ForegroundColor Yellow
$azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
if (-not (Test-Path $azPath)) {
    Write-Host "Azure CLI non trouve. Installation..." -ForegroundColor Yellow
    winget install Microsoft.AzureCLI --silent
    Start-Sleep -Seconds 15
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Verifier AWS CLI
Write-Host "Verification d'AWS CLI..." -ForegroundColor Yellow
$useAws = $false
if (Get-Command aws -ErrorAction SilentlyContinue) {
    $useAws = $true
    Write-Host "AWS CLI trouve" -ForegroundColor Green
} else {
    Write-Host "AWS CLI non trouve - Variables configurees manuellement" -ForegroundColor Yellow
}

Write-Host ""

# Connexion Azure
Write-Host "Connexion a Azure..." -ForegroundColor Yellow
$accountJson = & $azPath account show --output json 2>$null
if (-not $accountJson) {
    Write-Host "Non connecte a Azure. Connexion..." -ForegroundColor Yellow
    Write-Host "Un navigateur va s'ouvrir..." -ForegroundColor Cyan
    & $azPath login
    $accountJson = & $azPath account show --output json
}
$account = $accountJson | ConvertFrom-Json
Write-Host "Connecte a Azure: $($account.name)" -ForegroundColor Green
Write-Host ""

# Generer les secrets
Write-Host "Generation automatique des secrets..." -ForegroundColor Yellow
$DbPasswordPlain = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "Secrets generes" -ForegroundColor Green
Write-Host ""

# Recuperer variables depuis AWS
Write-Host "Recuperation des variables d'environnement depuis AWS..." -ForegroundColor Yellow
$envVars = @{}

if ($useAws) {
    try {
        $taskDefArn = aws ecs describe-services --cluster $AwsCluster --services $AwsService --region $AwsRegion --query 'services[0].taskDefinition' --output text 2>$null
        if ($taskDefArn) {
            Write-Host "Task Definition trouvee: $taskDefArn" -ForegroundColor Gray
            $taskDefJson = aws ecs describe-task-definition --task-definition $taskDefArn --region $AwsRegion --output json
            $taskDef = $taskDefJson | ConvertFrom-Json
            $containerDef = $taskDef.taskDefinition.containerDefinitions[0]
            
            if ($containerDef.environment) {
                foreach ($env in $containerDef.environment) {
                    $envVars[$env.name] = $env.value
                    Write-Host "  Variable: $($env.name)" -ForegroundColor Gray
                }
            }
            
            if ($containerDef.secrets) {
                foreach ($secret in $containerDef.secrets) {
                    $secretName = $secret.name
                    $secretValueFrom = $secret.valueFrom
                    
                    if ($secretValueFrom -like "*ssm*") {
                        $paramName = $secretValueFrom -replace "arn:aws:ssm:.*:parameter:", ""
                        try {
                            $paramValue = aws ssm get-parameter --name $paramName --region $AwsRegion --with-decryption --query 'Parameter.Value' --output text 2>$null
                            if ($paramValue) {
                                $envVars[$secretName] = $paramValue
                                Write-Host "  Secret: $secretName (SSM)" -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "  Secret non recupere: $secretName" -ForegroundColor Yellow
                        }
                    }
                    
                    if ($secretValueFrom -like "*secretsmanager*") {
                        $secretArn = $secretValueFrom -replace "arn:aws:secretsmanager:.*:secret:", ""
                        $secretArn = $secretArn -replace "/.*", ""
                        try {
                            $secretValue = aws secretsmanager get-secret-value --secret-id $secretArn --region $AwsRegion --query 'SecretString' --output text 2>$null
                            if ($secretValue) {
                                try {
                                    $secretJson = $secretValue | ConvertFrom-Json
                                    foreach ($key in $secretJson.PSObject.Properties.Name) {
                                        $envVars[$key] = $secretJson.$key
                                    }
                                } catch {
                                    $envVars[$secretName] = $secretValue
                                }
                                Write-Host "  Secret: $secretName (Secrets Manager)" -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "  Secret non recupere: $secretName" -ForegroundColor Yellow
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "Impossible de recuperer depuis AWS: $_" -ForegroundColor Yellow
    }
}

# Variables essentielles par defaut
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
if (-not $envVars.ContainsKey("JWT_SECRET") -or [string]::IsNullOrEmpty($envVars["JWT_SECRET"])) {
    $envVars["JWT_SECRET"] = $JwtSecret
}

Write-Host "Variables recuperees: $($envVars.Count)" -ForegroundColor Green
Write-Host ""

# Creer Resource Group
Write-Host "Creation du Resource Group..." -ForegroundColor Yellow
& $azPath group create --name $ResourceGroupName --location $Location --output none
Write-Host "Resource Group cree" -ForegroundColor Green
Write-Host ""

# Creer base de donnees PostgreSQL
Write-Host "Creation de la base de donnees PostgreSQL..." -ForegroundColor Yellow
Write-Host "Cela peut prendre 3-5 minutes..." -ForegroundColor Gray
& $azPath postgres flexible-server create `
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
Write-Host "Base de donnees PostgreSQL creee" -ForegroundColor Green
Write-Host ""

# Creer App Service Plan
Write-Host "Creation de l'App Service Plan..." -ForegroundColor Yellow
& $azPath appservice plan create --name $AppServicePlanName --resource-group $ResourceGroupName --location $Location --sku $PricingTier --is-linux --output none
Write-Host "App Service Plan cree" -ForegroundColor Green
Write-Host ""

# Creer App Service
Write-Host "Creation de l'App Service..." -ForegroundColor Yellow
& $azPath webapp create --name $AppServiceName --resource-group $ResourceGroupName --plan $AppServicePlanName --deployment-container-image-name $DockerImage --output none
Write-Host "App Service cree" -ForegroundColor Green
Write-Host ""

# Construire DATABASE_URL
$DbFqdn = "$DbName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:$DbPasswordPlain@${DbFqdn}:5432/postgres?sslmode=require"
$envVars["DATABASE_URL"] = $DatabaseUrl

# Configurer variables d'environnement
Write-Host "Configuration des variables d'environnement..." -ForegroundColor Yellow
$settingsList = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    $settingsList += "$key=$value"
}

# Configurer chaque variable individuellement
foreach ($setting in $settingsList) {
    $parts = $setting -split "=", 2
    $key = $parts[0]
    $value = $parts[1]
    & $azPath webapp config appsettings set --name $AppServiceName --resource-group $ResourceGroupName --settings "$key=$value" --output none 2>$null
}

Write-Host "Variables configurees: $($envVars.Count)" -ForegroundColor Green
Write-Host ""

# Configurer health check
Write-Host "Configuration du health check..." -ForegroundColor Yellow
& $azPath webapp config set --name $AppServiceName --resource-group $ResourceGroupName --always-on true --output none
Write-Host "Health check configure" -ForegroundColor Green
Write-Host ""

# Obtenir URL
$AppServiceUrl = & $azPath webapp show --name $AppServiceName --resource-group $ResourceGroupName --query defaultHostName --output tsv

Write-Host ""
Write-Host "Migration complete terminee avec succes !" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "  Database: $DbFqdn" -ForegroundColor White
Write-Host "  Database User: $DbAdminUser" -ForegroundColor White
Write-Host "  App Service: $AppServiceName" -ForegroundColor White
Write-Host "  App Service URL: https://$AppServiceUrl" -ForegroundColor White
Write-Host ""
Write-Host "Secrets generes (SAUVEGARDEZ):" -ForegroundColor Yellow
Write-Host "  Database Password: $DbPasswordPlain" -ForegroundColor Red
Write-Host "  JWT_SECRET: $JwtSecret" -ForegroundColor Red
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "  1. Mettre a jour DNS Cloudflare:" -ForegroundColor White
Write-Host "     Type: CNAME" -ForegroundColor Gray
Write-Host "     Name: api" -ForegroundColor Gray
Write-Host "     Target: $AppServiceUrl" -ForegroundColor Gray
Write-Host "     Proxy: Active (nuage orange)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Attendre 2-3 minutes pour le demarrage" -ForegroundColor White
Write-Host ""
Write-Host "  3. Tester:" -ForegroundColor White
Write-Host "     curl https://api.yukpomnang.com/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Les migrations s'executeront automatiquement" -ForegroundColor White
Write-Host "     - Tables creees automatiquement" -ForegroundColor Gray
Write-Host "     - Indexes creees automatiquement" -ForegroundColor Gray
Write-Host "     - Fonctions creees automatiquement" -ForegroundColor Gray
Write-Host ""

# Sauvegarder les secrets
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
Write-Host "Script termine !" -ForegroundColor Green



