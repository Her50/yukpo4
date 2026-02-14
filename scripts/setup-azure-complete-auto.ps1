# 🚀 Script de Configuration Complète Azure + GitHub (100% Automatique)
# Usage: .\scripts\setup-azure-complete-auto.ps1

param(
    [string]$ResourceGroupName = "yukpomnang-rg",
    [string]$Location = "westeurope",
    [string]$AcrName = "yukpomnangregistry",
    [string]$AppServiceName = "yukpo-backend",
    [string]$AppServicePlanName = "yukpo-backend-plan",
    [string]$DockerImage = "ghcr.io/Her50/yukpo4/yukpomnang-backend-optimized:latest",
    [string]$PricingTier = "F1",  # F1 = Free, B1 = Basic (~$13/mois)
    [string]$GitHubRepo = "Her50/yukpo4"  # Format: owner/repo
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Configuration Complète Azure + GitHub (100% Automatique)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre à jour le PATH pour inclure Azure CLI et GitHub CLI
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
    $azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    if (Test-Path $azPath) {
        $env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
    }
}

# Utiliser le chemin complet pour az
$azExe = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
if (-not (Test-Path $azExe)) {
    Write-Host "❌ Azure CLI non trouvé après installation" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Azure CLI trouvé" -ForegroundColor Green
Write-Host ""

# Vérifier GitHub CLI
Write-Host "📋 Vérification de GitHub CLI..." -ForegroundColor Yellow
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    Write-Host "⚠️  GitHub CLI non trouvé - Installation..." -ForegroundColor Yellow
    winget install GitHub.cli --silent
    Start-Sleep -Seconds 10
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    Write-Host "⚠️  GitHub CLI non disponible - Les secrets devront être configurés manuellement" -ForegroundColor Yellow
    $useGitHubCLI = $false
} else {
    Write-Host "✅ GitHub CLI trouvé" -ForegroundColor Green
    $useGitHubCLI = $true
}
Write-Host ""

# Connexion Azure (simplifiée avec GitHub)
Write-Host "📋 Connexion à Azure..." -ForegroundColor Yellow
$account = & $azExe account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "⚠️  Non connecté à Azure. Connexion..." -ForegroundColor Yellow
    Write-Host "   Si vous avez créé Azure avec GitHub, utilisez l'authentification GitHub" -ForegroundColor Cyan
    & $azExe login
    $account = & $azExe account show --output json | ConvertFrom-Json
}

Write-Host "✅ Connecté à Azure" -ForegroundColor Green
Write-Host "   Subscription: $($account.name) ($($account.id))" -ForegroundColor Gray
Write-Host ""

# Obtenir les IDs Azure
Write-Host "🔍 Récupération des IDs Azure..." -ForegroundColor Yellow
$SubscriptionId = $account.id
$TenantId = $account.tenantId

Write-Host "✅ Subscription ID: $SubscriptionId" -ForegroundColor Green
Write-Host "✅ Tenant ID: $TenantId" -ForegroundColor Green
Write-Host ""

# Créer ou vérifier le Resource Group
Write-Host "📦 Création/Vérification du Resource Group..." -ForegroundColor Yellow
$rgExists = & $azExe group exists --name $ResourceGroupName --output tsv
if ($rgExists -eq "false") {
    & $azExe group create --name $ResourceGroupName --location $Location --output none
    Write-Host "✅ Resource Group créé: $ResourceGroupName" -ForegroundColor Green
} else {
    Write-Host "✅ Resource Group existe déjà: $ResourceGroupName" -ForegroundColor Green
}
Write-Host ""

# Créer ou vérifier Azure Container Registry (ACR)
Write-Host "📦 Création/Vérification d'Azure Container Registry..." -ForegroundColor Yellow
$acrExists = & $azExe acr show --name $AcrName --resource-group $ResourceGroupName --query "name" --output tsv 2>$null
if (-not $acrExists) {
    Write-Host "   Création de l'ACR (cela peut prendre 2-3 minutes)..." -ForegroundColor Gray
    & $azExe acr create `
        --resource-group $ResourceGroupName `
        --name $AcrName `
        --sku Basic `
        --admin-enabled true `
        --location $Location `
        --output none
    
    Write-Host "✅ ACR créé: $AcrName" -ForegroundColor Green
} else {
    Write-Host "✅ ACR existe déjà: $AcrName" -ForegroundColor Green
}
Write-Host ""

# Créer ou récupérer App Registration pour GitHub Actions
Write-Host "🔐 Configuration de l'App Registration pour GitHub Actions..." -ForegroundColor Yellow

# Chercher une App Registration existante
$appName = "github-actions-yukpo"
$existingApp = & $azExe ad app list --display-name $appName --query "[0]" --output json 2>$null | ConvertFrom-Json

if ($existingApp) {
    $ClientId = $existingApp.appId
    Write-Host "✅ App Registration existe déjà: $ClientId" -ForegroundColor Green
} else {
    Write-Host "   Création d'une nouvelle App Registration..." -ForegroundColor Gray
    $newApp = & $azExe ad app create --display-name $appName --output json | ConvertFrom-Json
    $ClientId = $newApp.appId
    Write-Host "✅ App Registration créée: $ClientId" -ForegroundColor Green
}

Write-Host "✅ Client ID: $ClientId" -ForegroundColor Green
Write-Host ""

# Assigner les permissions Contributor
Write-Host "🔐 Assignation des permissions Contributor..." -ForegroundColor Yellow
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
    Write-Host "✅ Permissions Contributor assignées" -ForegroundColor Green
} else {
    Write-Host "✅ Permissions Contributor déjà assignées" -ForegroundColor Green
}
Write-Host ""

# Configurer les secrets GitHub
Write-Host "🔐 Configuration des secrets GitHub..." -ForegroundColor Yellow

if ($useGitHubCLI) {
    # Vérifier la connexion GitHub
    $ghAuth = gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Non connecté à GitHub. Connexion..." -ForegroundColor Yellow
        gh auth login
    }

    # Configurer les secrets
    Write-Host "   Configuration de AZURE_CLIENT_ID..." -ForegroundColor Gray
    gh secret set AZURE_CLIENT_ID --body $ClientId --repo $GitHubRepo 2>$null
    
    Write-Host "   Configuration de AZURE_TENANT_ID..." -ForegroundColor Gray
    gh secret set AZURE_TENANT_ID --body $TenantId --repo $GitHubRepo 2>$null
    
    Write-Host "   Configuration de AZURE_SUBSCRIPTION_ID..." -ForegroundColor Gray
    gh secret set AZURE_SUBSCRIPTION_ID --body $SubscriptionId --repo $GitHubRepo 2>$null
    
    Write-Host "✅ Secrets GitHub configurés automatiquement" -ForegroundColor Green
} else {
    Write-Host "⚠️  GitHub CLI non disponible" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Yellow
    Write-Host "📋 Configurez manuellement ces secrets dans GitHub:" -ForegroundColor Cyan
    Write-Host "   Repository: https://github.com/$GitHubRepo/settings/secrets/actions" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "   Secret 1:" -ForegroundColor White
    Write-Host "     Name: AZURE_CLIENT_ID" -ForegroundColor Gray
    Write-Host "     Value: $ClientId" -ForegroundColor Gray
    Write-Host "" -ForegroundColor White
    Write-Host "   Secret 2:" -ForegroundColor White
    Write-Host "     Name: AZURE_TENANT_ID" -ForegroundColor Gray
    Write-Host "     Value: $TenantId" -ForegroundColor Gray
    Write-Host "" -ForegroundColor White
    Write-Host "   Secret 3:" -ForegroundColor White
    Write-Host "     Name: AZURE_SUBSCRIPTION_ID" -ForegroundColor Gray
    Write-Host "     Value: $SubscriptionId" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""

# Vérifier si la base de données existe
Write-Host "🗄️  Vérification de la base de données PostgreSQL..." -ForegroundColor Yellow
$dbName = "yukpo-db"
$dbExists = & $azExe postgres flexible-server show `
    --resource-group $ResourceGroupName `
    --name $dbName `
    --query "name" `
    --output tsv 2>$null

if (-not $dbExists) {
    Write-Host "⚠️  Base de données non trouvée. Migration du backend requise." -ForegroundColor Yellow
    Write-Host "   Exécutez: .\scripts\migrate-aws-to-azure-auto.ps1" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ Base de données existe: $dbName" -ForegroundColor Green
    Write-Host ""
}

# Vérifier si App Service existe
Write-Host "🚀 Vérification de l'App Service..." -ForegroundColor Yellow
$appServiceExists = & $azExe webapp show `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --query "name" `
    --output tsv 2>$null

if (-not $appServiceExists) {
    Write-Host "⚠️  App Service non trouvé. Migration du backend requise." -ForegroundColor Yellow
    Write-Host "   Exécutez: .\scripts\migrate-aws-to-azure-auto.ps1" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ App Service existe: $AppServiceName" -ForegroundColor Green
    Write-Host ""
}

# Résumé
Write-Host ""
Write-Host "✅ Configuration terminée avec succès !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Informations importantes:" -ForegroundColor Cyan
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "   ACR: $AcrName.azurecr.io" -ForegroundColor White
Write-Host "   Subscription ID: $SubscriptionId" -ForegroundColor White
Write-Host "   Tenant ID: $TenantId" -ForegroundColor White
Write-Host "   Client ID: $ClientId" -ForegroundColor White
Write-Host ""

if (-not $dbExists -or -not $appServiceExists) {
    Write-Host "🌐 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Migrer le backend vers Azure:" -ForegroundColor White
    Write-Host "      .\scripts\migrate-aws-to-azure-auto.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Tester le workflow GitHub Actions:" -ForegroundColor White
    Write-Host "      git push origin main" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "🌐 Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "   1. Tester le workflow GitHub Actions:" -ForegroundColor White
    Write-Host "      git push origin main" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Vérifier les déploiements:" -ForegroundColor White
    Write-Host "      https://github.com/$GitHubRepo/actions" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "✅ Script terminé !" -ForegroundColor Green

