# Script pour appliquer les migrations d'optimisation directement sur Cloud SQL GCP
# Date: 2026-02-18
# Usage: .\scripts\apply-optimization-migrations-gcp.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db"
)

Write-Host "🚀 Application des migrations d'optimisation sur Cloud SQL GCP" -ForegroundColor Green
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    Write-Host "Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "🔐 Vérification de l'authentification GCP..." -ForegroundColor Cyan
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "❌ ERREUR: Vous n'êtes pas authentifié sur GCP" -ForegroundColor Red
    Write-Host "Exécutez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Authentifié: $authStatus" -ForegroundColor Green

# Définir le projet
Write-Host ""
Write-Host "⚙️ Configuration du projet GCP..." -ForegroundColor Cyan
gcloud config set project $ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de configurer le projet" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet configuré: $ProjectId" -ForegroundColor Green

# Vérifier que l'instance Cloud SQL existe
Write-Host ""
Write-Host "🔍 Vérification de l'instance Cloud SQL..." -ForegroundColor Cyan
$instanceInfo = gcloud sql instances describe $InstanceName --project=$ProjectId --format="value(name,state)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Instance Cloud SQL '$InstanceName' introuvable" -ForegroundColor Red
    Write-Host "Vérifiez que l'instance existe avec: gcloud sql instances list --project=$ProjectId" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Instance trouvée: $InstanceName" -ForegroundColor Green

# Lire le fichier SQL consolidé
$migrationFile = Join-Path $PSScriptRoot "apply-optimization-migrations-direct.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Lecture de la migration: $migrationFile" -ForegroundColor Cyan
$migrationContent = Get-Content $migrationFile -Raw -Encoding UTF8
Write-Host "✅ Migration chargée ($($migrationContent.Length) caractères)" -ForegroundColor Green

# Créer un fichier temporaire pour la migration
$tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
$migrationContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "🔄 Application de la migration sur Cloud SQL..." -ForegroundColor Cyan
Write-Host "   Instance: $InstanceName" -ForegroundColor Gray
Write-Host "   Database: $DatabaseName" -ForegroundColor Gray

# Appliquer la migration via gcloud sql execute-sql
$result = gcloud sql connect $InstanceName `
    --database=$DatabaseName `
    --project=$ProjectId `
    --quiet `
    2>&1

# Alternative: Utiliser gcloud sql execute-sql si disponible
Write-Host ""
Write-Host "💡 Pour appliquer la migration, utilisez une des méthodes suivantes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Via gcloud sql connect (interactif)" -ForegroundColor Cyan
Write-Host "   gcloud sql connect $InstanceName --database=$DatabaseName --project=$ProjectId" -ForegroundColor White
Write-Host "   Puis exécutez: \i $migrationFile" -ForegroundColor White
Write-Host ""
Write-Host "Option 2: Via psql directement (si vous avez l'IP publique)" -ForegroundColor Cyan
Write-Host "   psql -h [IP_PUBLIQUE] -U yukpo_user -d $DatabaseName -f $migrationFile" -ForegroundColor White
Write-Host ""
Write-Host "Option 3: Via Cloud SQL Proxy (recommandé)" -ForegroundColor Cyan
Write-Host "   1. Installer Cloud SQL Proxy" -ForegroundColor White
Write-Host "   2. cloud_sql_proxy -instances=$ProjectId`:$Region`:$InstanceName=tcp:5432" -ForegroundColor White
Write-Host "   3. psql -h localhost -U yukpo_user -d $DatabaseName -f $migrationFile" -ForegroundColor White
Write-Host ""
Write-Host "📄 Fichier SQL: $migrationFile" -ForegroundColor Cyan
Write-Host "📄 Fichier temporaire: $tempFile" -ForegroundColor Gray

# Nettoyer le fichier temporaire après affichage
Start-Sleep -Seconds 2
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Instructions affichées. Appliquez la migration avec une des méthodes ci-dessus." -ForegroundColor Green

