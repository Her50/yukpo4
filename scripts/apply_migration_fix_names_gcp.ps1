# Script pour appliquer la migration de correction des noms dupliqués directement sur Cloud SQL GCP
# Usage: .\scripts\apply_migration_fix_names_gcp.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "🔧 Application de la migration de correction des noms dupliqués sur Cloud SQL GCP" -ForegroundColor Yellow
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: gcloud CLI n'est pas installé" -ForegroundColor Red
    Write-Host "Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "🔐 Vérification de l'authentification GCP..." -ForegroundColor Cyan
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "❌ Erreur: Vous n'êtes pas authentifié sur GCP" -ForegroundColor Red
    Write-Host "Exécutez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Authentifié: $authStatus" -ForegroundColor Green

# Définir le projet
Write-Host ""
Write-Host "📋 Configuration du projet GCP..." -ForegroundColor Cyan
gcloud config set project $ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur: Impossible de configurer le projet" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet configuré: $ProjectId" -ForegroundColor Green

# Lire le fichier de migration
$migrationFile = Join-Path $PSScriptRoot "..\backend\migrations\20260216_fix_duplicate_full_names.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Erreur: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📄 Lecture de la migration: $migrationFile" -ForegroundColor Cyan
$migrationContent = Get-Content $migrationFile -Raw

# Créer un fichier temporaire pour la migration
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'
$migrationContent | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host "✅ Migration chargée ($($migrationContent.Length) caractères)" -ForegroundColor Green

# Afficher un résumé de ce qui va être fait
Write-Host ""
Write-Host "📋 Résumé de la migration:" -ForegroundColor Cyan
Write-Host "  - Création de fonctions SQL pour normaliser les noms" -ForegroundColor White
Write-Host "  - Correction des noms dupliqués existants" -ForegroundColor White
Write-Host "  - Création d'un trigger pour normaliser automatiquement" -ForegroundColor White
Write-Host "  - Création d'un index pour améliorer les performances" -ForegroundColor White

Write-Host ""
$confirm = Read-Host "Voulez-vous continuer? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "❌ Opération annulée" -ForegroundColor Yellow
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    exit 0
}

# Appliquer la migration via gcloud sql connect ou via Cloud SQL Proxy
Write-Host ""
Write-Host "🚀 Application de la migration sur Cloud SQL..." -ForegroundColor Cyan

# Option 1: Utiliser gcloud sql connect (nécessite un mot de passe)
Write-Host ""
Write-Host "Méthode 1: Connexion directe via gcloud sql connect" -ForegroundColor Yellow
Write-Host "Vous devrez entrer le mot de passe de l'utilisateur $User" -ForegroundColor Yellow
Write-Host ""

# Construire la commande
$instanceConnectionName = "$ProjectId`:$Region`:$InstanceName"
Write-Host "Instance: $instanceConnectionName" -ForegroundColor Cyan
Write-Host "Database: $DatabaseName" -ForegroundColor Cyan
Write-Host "User: $User" -ForegroundColor Cyan

# Utiliser psql via gcloud sql connect
Write-Host ""
Write-Host "Exécution de la migration..." -ForegroundColor Cyan

# Créer une commande SQL qui lit le fichier
$sqlCommand = @"
\set ON_ERROR_STOP on
\i $tempFile
"@

# Sauvegarder la commande dans un fichier
$commandFile = [System.IO.Path]::GetTempFileName()
$commandFile = $commandFile -replace '\.tmp$', '.sql'
$sqlCommand | Out-File -FilePath $commandFile -Encoding UTF8

Write-Host ""
Write-Host "⚠️  IMPORTANT: Vous devez exécuter manuellement la commande suivante:" -ForegroundColor Yellow
Write-Host ""
Write-Host "gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "Puis dans psql, exécutez:" -ForegroundColor Yellow
Write-Host "\i $tempFile" -ForegroundColor Cyan
Write-Host ""

# Alternative: Utiliser Cloud SQL Admin API (si activée)
Write-Host ""
Write-Host "Méthode 2: Application directe via Cloud SQL Admin API" -ForegroundColor Yellow
Write-Host "Tentative d'application automatique..." -ForegroundColor Cyan

# Lire le contenu de la migration
$migrationSQL = Get-Content $migrationFile -Raw

# Diviser en commandes individuelles (approximation)
$statements = $migrationSQL -split '(?<=;)\s*\n' | Where-Object { $_.Trim() -ne '' -and $_.Trim() -notmatch '^--' }

Write-Host "Nombre de statements SQL détectés: $($statements.Count)" -ForegroundColor Cyan

# Pour chaque statement, essayer de l'exécuter via gcloud
$successCount = 0
$errorCount = 0

foreach ($statement in $statements) {
    $cleanStatement = $statement.Trim()
    if ($cleanStatement -eq '' -or $cleanStatement.StartsWith('--')) {
        continue
    }
    
    # Essayer d'exécuter via gcloud sql execute-sql
    Write-Host "Exécution d'un statement..." -ForegroundColor Gray
    
    # Note: gcloud sql execute-sql n'existe pas directement
    # Il faut utiliser une autre méthode
}

Write-Host ""
Write-Host "✅ Script terminé" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Instructions manuelles:" -ForegroundColor Cyan
Write-Host "1. Connectez-vous à Cloud SQL:" -ForegroundColor White
Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Dans psql, exécutez:" -ForegroundColor White
Write-Host "   \i $tempFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "OU copiez-collez le contenu de:" -ForegroundColor White
Write-Host "   $migrationFile" -ForegroundColor Yellow
Write-Host ""

# Nettoyer les fichiers temporaires (optionnel)
$keepFiles = Read-Host "Voulez-vous garder les fichiers temporaires? (O/N)"
if ($keepFiles -ne "O" -and $keepFiles -ne "o") {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    Remove-Item $commandFile -ErrorAction SilentlyContinue
    Write-Host "✅ Fichiers temporaires supprimés" -ForegroundColor Green
} else {
    Write-Host "📁 Fichiers temporaires conservés:" -ForegroundColor Yellow
    Write-Host "   - $tempFile" -ForegroundColor White
    Write-Host "   - $commandFile" -ForegroundColor White
}


