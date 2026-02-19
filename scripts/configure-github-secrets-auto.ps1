# Script de Configuration Automatique des Secrets GitHub pour GCP
# Usage: .\scripts\configure-github-secrets-auto.ps1

param(
    [string]$GitHubRepo = "Her50/yukpo4",
    [string]$ProjectId = "yukpo-project",
    [string]$EnvVarsFile = "gcp-env-vars.json",
    [string]$GitHubToken = ""
)

$ErrorActionPreference = "Stop"

Write-Host "Configuration Automatique des Secrets GitHub pour GCP" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verifier GitHub CLI
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    Write-Host "ERREUR: GitHub CLI (gh) non trouve" -ForegroundColor Red
    Write-Host "Installez GitHub CLI depuis: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

Write-Host "GitHub CLI trouve: $(gh --version)" -ForegroundColor Green
Write-Host ""

# Authentification GitHub
Write-Host "Verification de l'authentification GitHub..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Authentification necessaire..." -ForegroundColor Yellow
    
    # Si un token est fourni, l'utiliser
    if ($GitHubToken) {
        Write-Host "Utilisation du token fourni..." -ForegroundColor Gray
        echo $GitHubToken | gh auth login --with-token
    } else {
        Write-Host "Options d'authentification:" -ForegroundColor Cyan
        Write-Host "  1. Authentification via navigateur (recommandee)" -ForegroundColor White
        Write-Host "  2. Authentification via token GitHub" -ForegroundColor White
        Write-Host ""
        $choice = Read-Host "Choisissez une option (1 ou 2)"
        
        if ($choice -eq "2") {
            Write-Host ""
            Write-Host "Pour creer un token GitHub:" -ForegroundColor Yellow
            Write-Host "  1. Allez sur: https://github.com/settings/tokens" -ForegroundColor White
            Write-Host "  2. Cliquez sur 'Generate new token (classic)'" -ForegroundColor White
            Write-Host "  3. Selectionnez les scopes: repo, workflow" -ForegroundColor White
            Write-Host "  4. Copiez le token genere" -ForegroundColor White
            Write-Host ""
            $token = Read-Host "Collez votre token GitHub" -AsSecureString
            $tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
            echo $tokenPlain | gh auth login --with-token
        } else {
            Write-Host ""
            Write-Host "Ouverture du navigateur pour l'authentification..." -ForegroundColor Cyan
            Write-Host "Si le navigateur ne s'ouvre pas, suivez les instructions affichees" -ForegroundColor Yellow
            gh auth login --web
        }
    }
    
    # Verifier l'authentification
    Start-Sleep -Seconds 2
    $authCheck = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR: Authentification echouee" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Authentifie avec succes" -ForegroundColor Green
} else {
    Write-Host "Deja authentifie" -ForegroundColor Green
    $authStatus | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}

Write-Host ""

# Lire les variables d'environnement
if (-not (Test-Path $EnvVarsFile)) {
    Write-Host "ERREUR: Fichier $EnvVarsFile non trouve" -ForegroundColor Red
    Write-Host "Executez d'abord le script migrate-to-gcp-complete.ps1 ou generate-gcp-env-vars.ps1" -ForegroundColor Yellow
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
    
    # Ignorer les valeurs placeholder
    if ($value -match "\[A_.*\]") {
        Write-Host "   Ignore: $key (valeur placeholder)" -ForegroundColor DarkGray
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



