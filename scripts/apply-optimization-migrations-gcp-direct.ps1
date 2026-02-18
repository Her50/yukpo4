# Script pour appliquer les migrations d'optimisation directement sur Cloud SQL GCP
# Date: 2026-02-18
# Usage: .\scripts\apply-optimization-migrations-gcp-direct.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = ""
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application des migrations d'optimisation sur Cloud SQL GCP" -ForegroundColor Green
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

# Vérifier l'authentification
Write-Host "🔐 Vérification de l'authentification GCP..." -ForegroundColor Cyan
gcloud config set project $ProjectId 2>&1 | Out-Null

# Lire le fichier SQL consolidé
$migrationFile = Join-Path $PSScriptRoot "apply-optimization-migrations-direct.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

$migrationContent = Get-Content $migrationFile -Raw -Encoding UTF8
Write-Host "✅ Migration chargée ($($migrationContent.Length) caractères)" -ForegroundColor Green

# Demander le mot de passe si non fourni
if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host ""
    $securePassword = Read-Host "Entrez le mot de passe pour $User" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

$connectionName = "$ProjectId`:$Region`:$InstanceName"

# Méthode 1: Utiliser Cloud SQL Proxy (si disponible)
$proxyAvailable = Get-Command cloud-sql-proxy -ErrorAction SilentlyContinue
if ($proxyAvailable) {
    Write-Host ""
    Write-Host "🔧 Utilisation de Cloud SQL Proxy..." -ForegroundColor Cyan
    
    $proxyPort = 5433
    Write-Host "   Démarrage du proxy sur port $proxyPort..." -ForegroundColor Gray
    
    # Démarrer le proxy en arrière-plan
    $proxyProcess = Start-Process -FilePath "cloud-sql-proxy" `
        -ArgumentList "$connectionName", "--port=$proxyPort" `
        -PassThru -NoNewWindow -WindowStyle Hidden
    
    # Attendre que le proxy démarre
    Start-Sleep -Seconds 5
    
    # Vérifier que le proxy écoute
    $listening = Test-NetConnection -ComputerName localhost -Port $proxyPort -InformationLevel Quiet -WarningAction SilentlyContinue
    if (-not $listening) {
        Write-Host "   ⚠️ Le proxy ne semble pas démarré, attente supplémentaire..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    
    # Créer le fichier SQL temporaire
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $migrationContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    # Utiliser psql pour se connecter via le proxy
    $env:PGPASSWORD = $Password
    Write-Host "   Application de la migration via le proxy..." -ForegroundColor Gray
    
    $result = Get-Content $tempFile | psql -h localhost -p $proxyPort -U $User -d $DatabaseName 2>&1
    
    # Arrêter le proxy
    Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès via Cloud SQL Proxy!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host ""
        Write-Host "⚠️ Erreur lors de l'application via proxy, essai méthode alternative..." -ForegroundColor Yellow
        Write-Host "   Erreur: $result" -ForegroundColor Gray
    }
}

# Méthode 2: Utiliser gcloud sql connect avec script
Write-Host ""
Write-Host "🔧 Utilisation de gcloud sql connect..." -ForegroundColor Cyan

# Créer un fichier temporaire avec le contenu de la migration
$tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
$migrationContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "📋 Pour appliquer la migration, exécutez:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   `$env:PGPASSWORD='$Password'" -ForegroundColor Cyan
Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Puis dans psql, exécutez:" -ForegroundColor Yellow
Write-Host "   \i $tempFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Ou copiez-collez le contenu du fichier SQL directement" -ForegroundColor Gray
Write-Host ""
Write-Host "📄 Fichier SQL: $tempFile" -ForegroundColor Cyan
Write-Host ""

# Afficher le contenu pour copier-coller
Write-Host "💡 Contenu SQL à exécuter (copier-coller dans psql):" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host $migrationContent -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ Instructions affichées. Le fichier SQL est disponible à: $tempFile" -ForegroundColor Green

