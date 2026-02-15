# Script de Configuration des Secrets GitHub pour GCP
# Usage: .\scripts\configure-github-secrets.ps1

param(
    [string]$GitHubRepo = "Her50/yukpo4",
    [string]$ProjectId = "yukpo-project",
    [string]$EnvVarsFile = "gcp-env-vars.json"
)

$ErrorActionPreference = "Stop"

Write-Host "Configuration des Secrets GitHub pour GCP" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier GitHub CLI
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    Write-Host "ERREUR: GitHub CLI (gh) non trouve" -ForegroundColor Red
    Write-Host "Installez GitHub CLI depuis: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Verifier l'authentification GitHub
Write-Host "Verification de l'authentification GitHub..." -ForegroundColor Yellow
$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Connexion a GitHub..." -ForegroundColor Yellow
    gh auth login
}

Write-Host "Authentifie a GitHub" -ForegroundColor Green
Write-Host ""

# Lire les variables d'environnement
if (-not (Test-Path $EnvVarsFile)) {
    Write-Host "ERREUR: Fichier $EnvVarsFile non trouve" -ForegroundColor Red
    Write-Host "Executez d'abord le script migrate-to-gcp-complete.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "Lecture des variables depuis $EnvVarsFile..." -ForegroundColor Yellow
$envVars = Get-Content $EnvVarsFile -Raw | ConvertFrom-Json
Write-Host "   $($envVars.PSObject.Properties.Count) variables trouvees" -ForegroundColor Green
Write-Host ""

# Lire la clé Service Account
$saKeyFile = "gcp-sa-key.json"
if (-not (Test-Path $saKeyFile)) {
    Write-Host "ATTENTION: Fichier $saKeyFile non trouve" -ForegroundColor Yellow
    Write-Host "La clé Service Account doit etre recuperee depuis GCP" -ForegroundColor Yellow
    Write-Host ""
    $useSaKey = Read-Host "Voulez-vous continuer sans GCP_SA_KEY? (o/N)"
    if ($useSaKey -ne "o" -and $useSaKey -ne "O") {
        exit 1
    }
    $saKeyContent = $null
} else {
    $saKeyContent = Get-Content $saKeyFile -Raw
    Write-Host "Cle Service Account trouvee: $saKeyFile" -ForegroundColor Green
}

Write-Host ""

# Configurer les secrets de base
Write-Host "Configuration des secrets GCP de base..." -ForegroundColor Yellow

if ($saKeyContent) {
    Write-Host "   Configuration de GCP_SA_KEY..." -ForegroundColor Gray
    gh secret set GCP_SA_KEY --body $saKeyContent --repo $GitHubRepo 2>&1 | Out-Null
    Write-Host "   GCP_SA_KEY configure" -ForegroundColor Green
}

# Recuperer DATABASE_URL depuis les variables
$databaseUrl = $envVars.DATABASE_URL
if ($databaseUrl) {
    Write-Host "   Configuration de GCP_DATABASE_URL..." -ForegroundColor Gray
    gh secret set GCP_DATABASE_URL --body $databaseUrl --repo $GitHubRepo 2>&1 | Out-Null
    Write-Host "   GCP_DATABASE_URL configure" -ForegroundColor Green
} else {
    Write-Host "   ATTENTION: DATABASE_URL non trouve dans les variables" -ForegroundColor Yellow
}

# Configurer GCP_PROJECT_ID
Write-Host "   Configuration de GCP_PROJECT_ID..." -ForegroundColor Gray
gh secret set GCP_PROJECT_ID --body $ProjectId --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_PROJECT_ID configure" -ForegroundColor Green

# Configurer GCP_REGION
Write-Host "   Configuration de GCP_REGION..." -ForegroundColor Gray
gh secret set GCP_REGION --body "europe-west1" --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_REGION configure" -ForegroundColor Green

# Configurer GCP_SERVICE_ACCOUNT_EMAIL
$serviceAccountEmail = "github-actions@${ProjectId}.iam.gserviceaccount.com"
Write-Host "   Configuration de GCP_SERVICE_ACCOUNT_EMAIL..." -ForegroundColor Gray
gh secret set GCP_SERVICE_ACCOUNT_EMAIL --body $serviceAccountEmail --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_SERVICE_ACCOUNT_EMAIL configure" -ForegroundColor Green

# Configurer GCP_DB_INSTANCE_CONNECTION_NAME
$dbInstanceConnectionName = "${ProjectId}:europe-west1:yukpo-db"
Write-Host "   Configuration de GCP_DB_INSTANCE_CONNECTION_NAME..." -ForegroundColor Gray
gh secret set GCP_DB_INSTANCE_CONNECTION_NAME --body $dbInstanceConnectionName --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_DB_INSTANCE_CONNECTION_NAME configure" -ForegroundColor Green

Write-Host ""
Write-Host "Secrets de base configures" -ForegroundColor Green
Write-Host ""

# Configurer toutes les variables d'environnement
Write-Host "Configuration de toutes les variables d'environnement..." -ForegroundColor Yellow
Write-Host "   (Cela peut prendre plusieurs minutes...)" -ForegroundColor Gray
Write-Host ""

$secretCount = 0
$errorCount = 0
$totalVars = $envVars.PSObject.Properties.Count

foreach ($prop in $envVars.PSObject.Properties) {
    $key = $prop.Name
    $value = $prop.Value
    
    # Ignorer les valeurs nulles ou vides
    if ($null -eq $value -or $value -eq "") {
        continue
    }
    
    # Convertir en string si necessaire
    $valueString = if ($value -is [string]) { $value } else { $value | ConvertTo-Json -Compress }
    
    $secretName = "GCP_ENV_$key"
    
    try {
        gh secret set $secretName --body $valueString --repo $GitHubRepo 2>&1 | Out-Null
        $secretCount++
        
        if ($secretCount % 10 -eq 0) {
            Write-Host "   [$secretCount/$totalVars] variables configurees..." -ForegroundColor DarkGray
        }
    } catch {
        $errorCount++
        Write-Host "   ATTENTION: Impossible de configurer $secretName" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Configuration terminee !" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   Secrets de base configures: 6" -ForegroundColor White
Write-Host "   Variables d'environnement configurees: $secretCount" -ForegroundColor White
if ($errorCount -gt 0) {
    Write-Host "   Erreurs: $errorCount" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Total secrets GitHub: $($secretCount + 6)" -ForegroundColor Green
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
Write-Host "   Liste des secrets: gh secret list --repo $GitHubRepo" -ForegroundColor Gray
Write-Host ""


