# Script simplifie pour appliquer la migration directement sur Cloud SQL GCP
# Usage: .\scripts\apply_migration_gcp_direct.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Application de la migration sur Cloud SQL GCP" -ForegroundColor Yellow
Write-Host ""

# Vérifier gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: gcloud CLI n'est pas installe" -ForegroundColor Red
    exit 1
}

# Vérifier l'authentification
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "ERREUR: Vous n'etes pas authentifie sur GCP" -ForegroundColor Red
    Write-Host "Executez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK Authentifie: $authStatus" -ForegroundColor Green

# Configurer le projet
gcloud config set project $ProjectId 2>&1 | Out-Null
Write-Host "OK Projet configure: $ProjectId" -ForegroundColor Green

# Lire le fichier de migration
$migrationFile = Join-Path $PSScriptRoot "..\backend\migrations\20260216_fix_duplicate_full_names.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Lecture de la migration: $migrationFile" -ForegroundColor Cyan
$migrationContent = Get-Content $migrationFile -Raw

# Créer un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'
$migrationContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host "OK Fichier temporaire cree: $tempFile" -ForegroundColor Green

# Demander le mot de passe
Write-Host ""
Write-Host "Mot de passe requis pour l'utilisateur $User" -ForegroundColor Yellow
$securePassword = Read-Host "Entrez le mot de passe" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "Application de la migration..." -ForegroundColor Cyan
Write-Host ""

# Méthode: Utiliser PGPASSWORD avec gcloud sql connect
$env:PGPASSWORD = $Password

Write-Host "Commande a executer:" -ForegroundColor Yellow
Write-Host ""
Write-Host "gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Puis dans psql, executez:" -ForegroundColor Yellow
Write-Host "\i $tempFile" -ForegroundColor Cyan
Write-Host ""

# Essayer d'exécuter automatiquement si psql est disponible
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "Tentative d'application automatique via Cloud SQL Proxy..." -ForegroundColor Cyan
    
    # Vérifier si Cloud SQL Proxy est disponible
    $proxyAvailable = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
    if ($proxyAvailable) {
        $connectionName = "$ProjectId`:europe-west1`:$InstanceName"
        $proxyPort = 5433
        
        Write-Host "Demarrage de Cloud SQL Proxy sur le port $proxyPort..." -ForegroundColor Gray
        $proxyProcess = Start-Process -FilePath "cloud-sql-proxy" -ArgumentList "$connectionName", "--port=$proxyPort" -PassThru -WindowStyle Hidden
        
        # Attendre que le proxy démarre
        Start-Sleep -Seconds 5
        
        # Construire la connection string
        $connectionString = "postgresql://${User}:${Password}@localhost:${proxyPort}/${DatabaseName}"
        
        Write-Host "Application de la migration..." -ForegroundColor Cyan
        $migrationContent | & psql $connectionString 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "OK Migration appliquee avec succes!" -ForegroundColor Green
        } else {
            Write-Host "ERREUR lors de l'application de la migration" -ForegroundColor Red
            Write-Host "Veuillez executer manuellement les commandes ci-dessus" -ForegroundColor Yellow
        }
        
        # Arrêter le proxy
        Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "Cloud SQL Proxy non installe" -ForegroundColor Yellow
        Write-Host "Installez-le depuis: https://cloud.google.com/sql/docs/postgres/sql-proxy" -ForegroundColor Gray
        Write-Host ""
        Write-Host "OU executez manuellement les commandes ci-dessus" -ForegroundColor Yellow
    }
} else {
    Write-Host "psql n'est pas installe" -ForegroundColor Yellow
    Write-Host "Installez PostgreSQL client ou executez manuellement les commandes ci-dessus" -ForegroundColor Gray
}

# Nettoyer
$env:PGPASSWORD = $null
$Password = $null

Write-Host ""
Write-Host "Fichier temporaire: $tempFile" -ForegroundColor Gray
Write-Host "Vous pouvez le supprimer apres avoir applique la migration" -ForegroundColor Gray
Write-Host ""
Write-Host "OK Script termine" -ForegroundColor Green


