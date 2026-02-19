# Script pour appliquer la migration de correction des noms dupliqués directement sur Cloud SQL GCP
# Usage: .\scripts\apply_migration_gcp_cloud_sql.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = ""
)

Write-Host "Application de la migration sur Cloud SQL GCP" -ForegroundColor Yellow
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: gcloud CLI n'est pas installe" -ForegroundColor Red
    Write-Host "Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "Verification de l'authentification GCP..." -ForegroundColor Cyan
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "ERREUR: Vous n'etes pas authentifie sur GCP" -ForegroundColor Red
    Write-Host "Exécutez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK Authentifie: $authStatus" -ForegroundColor Green

# Définir le projet
Write-Host ""
Write-Host "Configuration du projet GCP..." -ForegroundColor Cyan
gcloud config set project $ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible de configurer le projet" -ForegroundColor Red
    exit 1
}
Write-Host "OK Projet configure: $ProjectId" -ForegroundColor Green

# Vérifier que l'instance Cloud SQL existe
Write-Host ""
Write-Host "Verification de l'instance Cloud SQL..." -ForegroundColor Cyan
$instanceInfo = gcloud sql instances describe $InstanceName --project=$ProjectId --format="value(name,state,settings.ipConfiguration.ipAddresses[0].ipAddress)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Instance Cloud SQL '$InstanceName' introuvable" -ForegroundColor Red
    Write-Host "Vérifiez que l'instance existe avec: gcloud sql instances list --project=$ProjectId" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK Instance trouvee: $InstanceName" -ForegroundColor Green

# Lire le fichier de migration
$migrationFile = Join-Path $PSScriptRoot "..\backend\migrations\20260216_fix_duplicate_full_names.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Lecture de la migration: $migrationFile" -ForegroundColor Cyan
$migrationContent = Get-Content $migrationFile -Raw
Write-Host "OK Migration chargee ($($migrationContent.Length) caracteres)" -ForegroundColor Green

# Demander le mot de passe si non fourni
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host ""
    Write-Host "Mot de passe requis pour l'utilisateur $User" -ForegroundColor Yellow
    $securePassword = Read-Host "Entrez le mot de passe" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# Afficher un résumé
Write-Host ""
Write-Host "Resume de la migration:" -ForegroundColor Cyan
Write-Host "  Instance: $InstanceName" -ForegroundColor White
Write-Host "  Database: $DatabaseName" -ForegroundColor White
Write-Host "  User: $User" -ForegroundColor White
Write-Host "  Projet: $ProjectId" -ForegroundColor White
Write-Host ""
Write-Host "  Actions:" -ForegroundColor White
Write-Host "    - Création de fonctions SQL pour normaliser les noms" -ForegroundColor Gray
Write-Host "    - Correction des noms dupliqués existants" -ForegroundColor Gray
Write-Host "    - Création d'un trigger pour normaliser automatiquement" -ForegroundColor Gray
Write-Host "    - Création d'un index pour améliorer les performances" -ForegroundColor Gray

Write-Host ""
$confirm = Read-Host "Voulez-vous continuer? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Operation annulee" -ForegroundColor Yellow
    exit 0
}

# Méthode 1: Utiliser gcloud sql connect avec psql
Write-Host ""
Write-Host "Application de la migration via gcloud sql connect..." -ForegroundColor Cyan
Write-Host ""

# Créer un fichier temporaire avec le contenu de la migration
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'
$migrationContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host "Fichier temporaire cree: $tempFile" -ForegroundColor Gray

# Option 1: Utiliser PGPASSWORD avec gcloud sql connect
Write-Host ""
Write-Host "Méthode 1: Connexion directe via gcloud sql connect" -ForegroundColor Yellow
Write-Host ""

# Construire la commande
$connectionName = "$ProjectId`:$Region`:$InstanceName"
Write-Host "Connexion à: $connectionName" -ForegroundColor Cyan

# Utiliser PGPASSWORD pour éviter de demander le mot de passe interactivement
$env:PGPASSWORD = $Password

# Créer un script SQL qui exécute la migration
$sqlScript = @"
\set ON_ERROR_STOP on
\echo 'Début de la migration...'
\i $tempFile
\echo 'Migration terminée avec succès!'
"@

$scriptFile = [System.IO.Path]::GetTempFileName()
$scriptFile = $scriptFile -replace '\.tmp$', '.sql'
$sqlScript | Out-File -FilePath $scriptFile -Encoding UTF8

Write-Host ""
Write-Host "IMPORTANT: Executez manuellement la commande suivante:" -ForegroundColor Yellow
Write-Host ""
Write-Host "`$env:PGPASSWORD='$Password'; gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Puis dans psql, exécutez:" -ForegroundColor Yellow
Write-Host "\i $tempFile" -ForegroundColor Cyan
Write-Host ""

# Méthode 2: Utiliser Cloud SQL Proxy (si disponible)
Write-Host ""
Write-Host "Méthode 2: Utilisation de Cloud SQL Proxy (si installé)" -ForegroundColor Yellow

# Vérifier si cloud-sql-proxy est disponible
$proxyAvailable = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
if ($proxyAvailable) {
    Write-Host "OK Cloud SQL Proxy trouve" -ForegroundColor Green
    
    # Démarrer le proxy en arrière-plan
    Write-Host "Démarrage de Cloud SQL Proxy..." -ForegroundColor Cyan
    $proxyPort = 5433
    $proxyProcess = Start-Process -FilePath "cloud-sql-proxy" -ArgumentList "$connectionName", "--port=$proxyPort" -PassThru -NoNewWindow
    
    # Attendre que le proxy démarre
    Start-Sleep -Seconds 3
    
    # Utiliser psql pour se connecter via le proxy
    $connectionString = "postgresql://${User}:${Password}@localhost:${proxyPort}/${DatabaseName}"
    
    Write-Host "Application de la migration via le proxy..." -ForegroundColor Cyan
    $migrationContent | psql $connectionString 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK Migration appliquee avec succes!" -ForegroundColor Green
    } else {
        Write-Host "ERREUR lors de l'application de la migration" -ForegroundColor Red
    }
    
    # Arrêter le proxy
    Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Cloud SQL Proxy non installe" -ForegroundColor Yellow
    Write-Host "Installez-le depuis: https://cloud.google.com/sql/docs/postgres/sql-proxy" -ForegroundColor Gray
}

# Méthode 3: Utiliser gcloud sql execute-sql (si disponible)
Write-Host ""
Write-Host "Méthode 3: Utilisation de gcloud sql execute-sql" -ForegroundColor Yellow

# Diviser la migration en statements individuels
$statements = $migrationContent -split '(?<=;)\s*\n' | Where-Object { 
    $_.Trim() -ne '' -and 
    $_.Trim() -notmatch '^--' -and
    $_.Trim() -notmatch '^\s*$'
}

Write-Host "Nombre de statements SQL: $($statements.Count)" -ForegroundColor Cyan

# Note: gcloud sql execute-sql n'existe pas directement
# Il faut utiliser une autre méthode

Write-Host ""
Write-Host "Instructions manuelles:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Ouvrez PowerShell et exécutez:" -ForegroundColor White
Write-Host "   `$env:PGPASSWORD='VOTRE_MOT_DE_PASSE'" -ForegroundColor Yellow
Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Dans psql, exécutez:" -ForegroundColor White
Write-Host "   \i $tempFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "OU copiez-collez le contenu de:" -ForegroundColor White
Write-Host "   $migrationFile" -ForegroundColor Yellow
Write-Host ""

# Nettoyer le mot de passe de la mémoire
$env:PGPASSWORD = $null
$Password = $null

# Demander si on garde les fichiers temporaires
Write-Host ""
$keepFiles = Read-Host "Voulez-vous garder les fichiers temporaires? (O/N)"
if ($keepFiles -ne "O" -and $keepFiles -ne "o") {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    Remove-Item $scriptFile -ErrorAction SilentlyContinue
    Write-Host "OK Fichiers temporaires supprimes" -ForegroundColor Green
} else {
    Write-Host "Fichiers temporaires conserves:" -ForegroundColor Yellow
    Write-Host "   - $tempFile" -ForegroundColor White
    Write-Host "   - $scriptFile" -ForegroundColor White
}

Write-Host ""
Write-Host "OK Script termine" -ForegroundColor Green

