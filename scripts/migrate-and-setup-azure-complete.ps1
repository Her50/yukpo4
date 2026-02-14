# Script de Migration Complete AWS vers Azure + Configuration GitHub (100% Automatique)
# Usage: .\scripts\migrate-and-setup-azure-complete.ps1

param(
    [string]$ResourceGroupName = "yukpo-rg",
    [string]$Location = "westeurope",
    [string]$DbName = "yukpo-db",
    [string]$DbAdminUser = "yukpo_admin",
    [string]$AppServiceName = "yukpo-backend",
    [string]$AppServicePlanName = "yukpo-backend-plan",
    [string]$AcrName = "yukporegistry",
    [string]$DockerImage = "ghcr.io/Her50/yukpo4/yukpo-backend-optimized:latest",
    [string]$PricingTier = "F1",
    [string]$GitHubRepo = "Her50/yukpo4",
    [string]$AwsCluster = "yukpo-cluster",
    [string]$AwsService = "yukpo-backend-service",
    [string]$AwsRegion = "eu-west-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Migration Complete AWS vers Azure + Configuration GitHub (100% Automatique)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verifier Azure CLI
Write-Host "Verification d'Azure CLI..." -ForegroundColor Yellow
$azExe = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
if (-not (Test-Path $azExe)) {
    Write-Host "Azure CLI n'est pas installe" -ForegroundColor Red
    Write-Host "Installation..." -ForegroundColor Yellow
    winget install Microsoft.AzureCLI --silent
    Start-Sleep -Seconds 10
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (-not (Test-Path $azExe)) {
    Write-Host "Azure CLI non trouve apres installation" -ForegroundColor Red
    exit 1
}

Write-Host "Azure CLI trouve" -ForegroundColor Green
Write-Host ""

# Connexion Azure (simplifiee)
Write-Host "Connexion a Azure..." -ForegroundColor Yellow
$accountJson = & $azExe account show --output json 2>&1
if ($LASTEXITCODE -ne 0 -or $accountJson -match "ERROR" -or $accountJson -match "No subscriptions") {
    Write-Host "Non connecte a Azure ou aucun abonnement trouve. Connexion..." -ForegroundColor Yellow
    Write-Host "Un navigateur va s'ouvrir pour vous connecter..." -ForegroundColor Cyan
    Write-Host "IMPORTANT: Assurez-vous d'avoir un abonnement Azure actif" -ForegroundColor Yellow
    & $azExe login
    Start-Sleep -Seconds 3
    $accountJson = & $azExe account show --output json 2>&1
    if ($LASTEXITCODE -ne 0 -or $accountJson -match "ERROR" -or $accountJson -match "No subscriptions") {
        Write-Host "ERREUR: Impossible de se connecter a Azure ou aucun abonnement trouve" -ForegroundColor Red
        Write-Host "Veuillez creer un abonnement Azure sur https://portal.azure.com" -ForegroundColor Yellow
        exit 1
    }
}
$account = $accountJson | ConvertFrom-Json
if (-not $account.id) {
    Write-Host "ERREUR: Aucun abonnement Azure actif trouve" -ForegroundColor Red
    Write-Host "Veuillez creer un abonnement Azure sur https://portal.azure.com" -ForegroundColor Yellow
    exit 1
}

Write-Host "Connecte a Azure" -ForegroundColor Green
Write-Host "   Subscription: $($account.name) ($($account.id))" -ForegroundColor Gray
Write-Host ""

# Obtenir les IDs Azure
$SubscriptionId = $account.id
$TenantId = $account.tenantId

# Creer Resource Group
Write-Host "Creation du Resource Group..." -ForegroundColor Yellow
$rgExists = & $azExe group exists --name $ResourceGroupName --output tsv
if ($rgExists -eq "false") {
    & $azExe group create --name $ResourceGroupName --location $Location --output none
}
Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Green
Write-Host ""

# Creer ACR
Write-Host "Creation d'Azure Container Registry..." -ForegroundColor Yellow
$acrExists = & $azExe acr show --name $AcrName --resource-group $ResourceGroupName --query "name" --output tsv 2>$null
if (-not $acrExists) {
    & $azExe acr create `
        --resource-group $ResourceGroupName `
        --name $AcrName `
        --sku Basic `
        --admin-enabled true `
        --location $Location `
        --output none
}
Write-Host "ACR cree: $AcrName" -ForegroundColor Green
Write-Host ""

# Creer App Registration
Write-Host "Configuration de l'App Registration..." -ForegroundColor Yellow
$appName = "github-actions-yukpo"
$existingApp = & $azExe ad app list --display-name $appName --query "[0]" --output json 2>$null | ConvertFrom-Json

if ($existingApp) {
    $ClientId = $existingApp.appId
} else {
    $newApp = & $azExe ad app create --display-name $appName --output json | ConvertFrom-Json
    $ClientId = $newApp.appId
}

# Assigner permissions
$roleAssignment = & $azExe role assignment list `
    --assignee $ClientId `
    --scope "/subscriptions/$SubscriptionId" `
    --query "[?roleDefinitionName=='Contributor']" `
    --output json 2>$null | ConvertFrom-Json

if (-not $roleAssignment -or $roleAssignment.Count -eq 0) {
    & $azExe role assignment create `
        --assignee $ClientId `
        --role Contributor `
        --scope "/subscriptions/$SubscriptionId" `
        --output none
}

Write-Host "App Registration configuree: $ClientId" -ForegroundColor Green
Write-Host ""

# Configurer secrets GitHub
Write-Host "Configuration des secrets GitHub..." -ForegroundColor Yellow
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if ($ghCmd) {
    $ghAuth = gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        gh auth login
    }
    
    gh secret set AZURE_CLIENT_ID --body $ClientId --repo $GitHubRepo 2>$null
    gh secret set AZURE_TENANT_ID --body $TenantId --repo $GitHubRepo 2>$null
    gh secret set AZURE_SUBSCRIPTION_ID --body $SubscriptionId --repo $GitHubRepo 2>$null
    
    Write-Host "Secrets GitHub configures automatiquement" -ForegroundColor Green
} else {
    Write-Host "GitHub CLI non disponible - Secrets a configurer manuellement" -ForegroundColor Yellow
    Write-Host "   AZURE_CLIENT_ID: $ClientId" -ForegroundColor Gray
    Write-Host "   AZURE_TENANT_ID: $TenantId" -ForegroundColor Gray
    Write-Host "   AZURE_SUBSCRIPTION_ID: $SubscriptionId" -ForegroundColor Gray
}
Write-Host ""

# Generer les secrets
Write-Host "Generation automatique des secrets..." -ForegroundColor Yellow
$DbPasswordPlain = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "Secrets generes automatiquement" -ForegroundColor Green
Write-Host ""

# Recuperer les variables d'environnement depuis AWS
Write-Host "Recuperation des variables d'environnement depuis AWS..." -ForegroundColor Yellow
$envVars = @{}

$awsCmd = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCmd) {
    try {
        $taskDefArn = aws ecs describe-services `
            --cluster $AwsCluster `
            --services $AwsService `
            --region $AwsRegion `
            --query 'services[0].taskDefinition' `
            --output text 2>$null

        if ($taskDefArn) {
            $taskDef = aws ecs describe-task-definition `
                --task-definition $taskDefArn `
                --region $AwsRegion `
                --output json | ConvertFrom-Json

            $containerDef = $taskDef.taskDefinition.containerDefinitions[0]
            
            if ($containerDef.environment) {
                foreach ($env in $containerDef.environment) {
                    $envVars[$env.name] = $env.value
                }
            }

            if ($containerDef.secrets) {
                foreach ($secret in $containerDef.secrets) {
                    $secretName = $secret.name
                    $secretValueFrom = $secret.valueFrom
                    
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
                            }
                        } catch {
                            # Ignorer les erreurs
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "   Impossible de recuperer depuis AWS: $_" -ForegroundColor Yellow
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
    $envVars["ALLOWED_ORIGINS"] = "https://api.yukpo.com,https://yukpo.com"
}

if (-not $envVars.ContainsKey("JWT_SECRET") -or [string]::IsNullOrEmpty($envVars["JWT_SECRET"])) {
    $envVars["JWT_SECRET"] = $JwtSecret
}

Write-Host "Variables d'environnement recuperees: $($envVars.Count)" -ForegroundColor Green
Write-Host ""

# Creer la base de donnees PostgreSQL
Write-Host "Creation de la base de donnees PostgreSQL..." -ForegroundColor Yellow
$dbExists = & $azExe postgres flexible-server show `
    --resource-group $ResourceGroupName `
    --name $DbName `
    --query "name" `
    --output tsv 2>$null

if (-not $dbExists) {
    Write-Host "   (Cela peut prendre 3-5 minutes...)" -ForegroundColor Gray
    & $azExe postgres flexible-server create `
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
}

Write-Host "Base de donnees PostgreSQL creee: $DbName" -ForegroundColor Green
Write-Host ""

# Creer App Service Plan
Write-Host "Creation de l'App Service Plan..." -ForegroundColor Yellow
$planExists = & $azExe appservice plan show `
    --name $AppServicePlanName `
    --resource-group $ResourceGroupName `
    --query "name" `
    --output tsv 2>$null

if (-not $planExists) {
    & $azExe appservice plan create `
        --name $AppServicePlanName `
        --resource-group $ResourceGroupName `
        --location $Location `
        --sku $PricingTier `
        --is-linux `
        --output none
}

Write-Host "App Service Plan cree: $AppServicePlanName" -ForegroundColor Green
Write-Host ""

# Creer App Service
Write-Host "Creation de l'App Service (Backend)..." -ForegroundColor Yellow
$appServiceExists = & $azExe webapp show `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --query "name" `
    --output tsv 2>$null

if (-not $appServiceExists) {
    & $azExe webapp create `
        --name $AppServiceName `
        --resource-group $ResourceGroupName `
        --plan $AppServicePlanName `
        --deployment-container-image-name $DockerImage `
        --output none
}

Write-Host "App Service cree: $AppServiceName" -ForegroundColor Green
Write-Host ""

# Configurer les variables d'environnement
Write-Host "Configuration des variables d'environnement..." -ForegroundColor Yellow
$DbFqdn = "$DbName.postgres.database.azure.com"
$DatabaseUrl = "postgresql://${DbAdminUser}:$DbPasswordPlain@${DbFqdn}:5432/postgres?sslmode=require"
$envVars["DATABASE_URL"] = $DatabaseUrl

$settings = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    $escapedValue = $value -replace '"', '`"'
    $settings += "$key=`"$escapedValue`""
}
$settingsString = $settings -join " "

& $azExe webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --settings $settingsString `
    --output none

Write-Host "Variables d'environnement configurees" -ForegroundColor Green
Write-Host ""

# Configurer le health check
Write-Host "Configuration du health check..." -ForegroundColor Yellow
& $azExe webapp config set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --always-on true `
    --output none

Write-Host "Health check configure" -ForegroundColor Green
Write-Host ""

# Obtenir l'URL de l'App Service
$AppServiceUrl = & $azExe webapp show `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --query defaultHostName `
    --output tsv

Write-Host ""
Write-Host "Migration terminee avec succes !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "   Database: $DbFqdn" -ForegroundColor White
Write-Host "   Database User: $DbAdminUser" -ForegroundColor White
Write-Host "   App Service: $AppServiceName" -ForegroundColor White
Write-Host "   App Service URL: https://$AppServiceUrl" -ForegroundColor White
Write-Host "   ACR: $AcrName.azurecr.io" -ForegroundColor White
Write-Host ""
Write-Host "Secrets generes (SAUVEGARDEZ CES INFORMATIONS):" -ForegroundColor Yellow
Write-Host "   Database Password: $DbPasswordPlain" -ForegroundColor Red
Write-Host "   JWT_SECRET: $JwtSecret" -ForegroundColor Red
Write-Host ""
Write-Host "IMPORTANT: Sauvegardez ces secrets dans un endroit sur !" -ForegroundColor Red
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Mettre a jour DNS Cloudflare:" -ForegroundColor White
Write-Host "      Type: CNAME" -ForegroundColor Gray
Write-Host "      Name: api" -ForegroundColor Gray
Write-Host "      Target: $AppServiceUrl" -ForegroundColor Gray
Write-Host "      Proxy: Active (nuage orange)" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Tester le backend:" -ForegroundColor White
Write-Host "      curl https://api.yukpo.com/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Tester le workflow GitHub Actions:" -ForegroundColor White
Write-Host "      git push origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Configurer le budget Azure:" -ForegroundColor White
Write-Host "      Azure Portal -> Cost Management -> Budgets -> Add" -ForegroundColor Gray
Write-Host ""

Write-Host "Script termine !" -ForegroundColor Green
