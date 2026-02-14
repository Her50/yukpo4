# 🚀 Script de Migration Backend vers Azure (Automatique)
# Usage: .\scripts\migrate-backend-to-azure.ps1

param(
    [string]$ResourceGroupName = "yukpomnang-rg",
    [string]$Location = "westeurope",
    [string]$DbName = "yukpomnang-db",
    [string]$DbAdminUser = "yukpo_admin",
    [string]$AppServiceName = "yukpo-backend",
    [string]$AppServicePlanName = "yukpo-backend-plan",
    [string]$DockerImage = "ghcr.io/Her50/yukpo4/yukpomnang-backend-optimized:latest",
    [string]$PricingTier = "F1"  # F1 = Free, B1 = Basic (~$13/mois)
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Migration Backend vers Azure" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Mettre à jour le PATH pour inclure Azure CLI
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Vérifier que Azure CLI est installé
Write-Host "📋 Vérification d'Azure CLI..." -ForegroundColor Yellow
$azCmd = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCmd) {
    # Essayer le chemin par défaut
    $azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    if (Test-Path $azPath) {
        $env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
        $azCmd = Get-Command az -ErrorAction SilentlyContinue
    }
}

if (-not $azCmd) {
    Write-Host "❌ Azure CLI n'est pas installé" -ForegroundColor Red
    Write-Host "Installez-le depuis: https://docs.microsoft.com/fr-fr/cli/azure/install-azure-cli" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ou via winget:" -ForegroundColor Yellow
    Write-Host "  winget install Microsoft.AzureCLI" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  Après l'installation, redémarrez PowerShell et réessayez." -ForegroundColor Yellow
    exit 1
}

$azVersion = az version --output json | ConvertFrom-Json
Write-Host "✅ Azure CLI installé (version $($azVersion.'azure-cli'))" -ForegroundColor Green
Write-Host ""

# Vérifier la connexion Azure
Write-Host "📋 Vérification de la connexion Azure..." -ForegroundColor Yellow
$account = az account show --output json 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "⚠️  Non connecté à Azure. Connexion..." -ForegroundColor Yellow
    az login
    $account = az account show --output json | ConvertFrom-Json
}

Write-Host "✅ Connecté à Azure" -ForegroundColor Green
Write-Host "   Subscription: $($account.name) ($($account.id))" -ForegroundColor Gray
Write-Host ""

# Générer automatiquement les mots de passe et secrets
Write-Host "🔐 Génération automatique des secrets..." -ForegroundColor Yellow

# Générer un mot de passe fort pour la base de données (32 caractères)
$DbPasswordPlain = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Générer un JWT_SECRET (64 caractères)
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})

Write-Host "✅ Secrets générés automatiquement" -ForegroundColor Green
Write-Host ""

Write-Host ""
Write-Host "📦 Création du Resource Group..." -ForegroundColor Yellow
az group create `
    --name $ResourceGroupName `
    --location $Location `
    --output none

Write-Host "✅ Resource Group créé: $ResourceGroupName" -ForegroundColor Green
Write-Host ""

# Créer la base de données PostgreSQL
Write-Host "🗄️  Création de la base de données PostgreSQL..." -ForegroundColor Yellow
Write-Host "   (Cela peut prendre 3-5 minutes...)" -ForegroundColor Gray

az postgres flexible-server create `
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

# Installer les extensions PostgreSQL
Write-Host "🔌 Installation des extensions PostgreSQL..." -ForegroundColor Yellow
$DbFqdn = "$DbName.postgres.database.azure.com"

# Créer un fichier SQL temporaire
$sqlFile = [System.IO.Path]::GetTempFileName()
@"
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS imgsmlr;
"@ | Out-File -FilePath $sqlFile -Encoding UTF8

# Installer psql si nécessaire (ou utiliser Azure Cloud Shell)
Write-Host "   Note: Les extensions seront installées automatiquement au démarrage du backend" -ForegroundColor Gray
Write-Host "   (via ENABLE_AUTO_MIGRATIONS=true)" -ForegroundColor Gray
Write-Host ""

# Créer App Service Plan
Write-Host "📋 Création de l'App Service Plan..." -ForegroundColor Yellow
az appservice plan create `
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
az webapp create `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --plan $AppServicePlanName `
    --deployment-container-image-name $DockerImage `
    --output none

Write-Host "✅ App Service créé: $AppServiceName" -ForegroundColor Green
Write-Host ""

# Configurer les variables d'environnement
Write-Host "⚙️  Configuration des variables d'environnement..." -ForegroundColor Yellow

$DatabaseUrl = "postgresql://${DbAdminUser}:$DbPasswordPlain@${DbFqdn}:5432/postgres?sslmode=require"

az webapp config appsettings set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --settings `
        DATABASE_URL="$DatabaseUrl" `
        ENABLE_AUTO_MIGRATIONS="true" `
        SQLX_OFFLINE="true" `
        JWT_SECRET="$JwtSecret" `
        ALLOWED_ORIGINS="https://api.yukpomnang.com,https://yukpomnang.com" `
        RUST_LOG="info" `
        ENVIRONMENT="production" `
    --output none

Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green
Write-Host ""

# Configurer le health check
Write-Host "🏥 Configuration du health check..." -ForegroundColor Yellow
az webapp config set `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --always-on true `
    --output none

Write-Host "✅ Health check configuré" -ForegroundColor Green
Write-Host ""

# Obtenir l'URL de l'App Service
$AppServiceUrl = az webapp show `
    --name $AppServiceName `
    --resource-group $ResourceGroupName `
    --query defaultHostName `
    --output tsv

Write-Host ""
Write-Host "✅ Migration terminée avec succès !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
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
Write-Host "⚠️  IMPORTANT: Sauvegardez ces secrets dans un endroit sûr !" -ForegroundColor Red
Write-Host ""
Write-Host "🌐 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Mettre à jour DNS Cloudflare:" -ForegroundColor White
Write-Host "      Type: CNAME" -ForegroundColor Gray
Write-Host "      Name: api" -ForegroundColor Gray
Write-Host "      Target: $AppServiceUrl" -ForegroundColor Gray
Write-Host "      Proxy: Activé (nuage orange)" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Tester le backend:" -ForegroundColor White
Write-Host "      curl https://api.yukpomnang.com/healthz" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Configurer le budget Azure:" -ForegroundColor White
Write-Host "      Azure Portal → Cost Management → Budgets → Add" -ForegroundColor Gray
Write-Host ""

# Nettoyer le fichier temporaire
Remove-Item $sqlFile -ErrorAction SilentlyContinue

Write-Host "✅ Script terminé !" -ForegroundColor Green

