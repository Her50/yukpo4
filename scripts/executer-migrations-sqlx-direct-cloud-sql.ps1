# Script pour exécuter les migrations SQLx directement sur Cloud SQL via gcloud
# Date: 2026-02-15
# Objectif: Exécuter les migrations SQLx au moins une fois pour créer les tables de base

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Execution Migrations SQLx Direct Cloud SQL" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Instance: $InstanceName"
Write-Host "   Database: $DatabaseName"
Write-Host "   User: $User"
Write-Host ""

# Etape 1: Lister les fichiers de migration
Write-Host "[ETAPE 1/3] Liste des fichiers de migration..." -ForegroundColor Yellow

$migrationsDir = "backend\migrations"
if (-not (Test-Path $migrationsDir)) {
    Write-Host "   [ERREUR] Dossier migrations non trouve: $migrationsDir" -ForegroundColor Red
    exit 1
}

$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

Write-Host "   [OK] $($migrationFiles.Count) fichiers de migration trouves" -ForegroundColor Green
Write-Host ""
Write-Host "   Fichiers de migration (premiers 20):" -ForegroundColor Cyan
$migrationFiles | Select-Object -First 20 | ForEach-Object {
    Write-Host "      - $($_.Name)" -ForegroundColor White
}

if ($migrationFiles.Count -gt 20) {
    Write-Host "      ... et $($migrationFiles.Count - 20) autres fichiers" -ForegroundColor Gray
}

Write-Host ""

# Etape 2: Creer un script SQL temporaire pour executer toutes les migrations
Write-Host "[ETAPE 2/3] Creation script SQL temporaire..." -ForegroundColor Yellow

$tempSqlFile = "temp_execute_all_migrations.sql"
$sqlContent = @"
-- Script temporaire pour executer toutes les migrations SQLx
-- Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- ATTENTION: Ce fichier sera supprime apres execution

-- Creer la table _sqlx_migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
);

-- Executer les migrations dans l'ordre
"@

foreach ($file in $migrationFiles) {
    $filePath = $file.FullName
    $relativePath = $filePath.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    
    $sqlContent += @"

-- Migration: $($file.Name)
\i $relativePath

"@
}

$sqlContent | Out-File -FilePath $tempSqlFile -Encoding UTF8
Write-Host "   [OK] Script SQL temporaire cree: $tempSqlFile" -ForegroundColor Green

Write-Host ""

# Etape 3: Instructions pour executer
Write-Host "[ETAPE 3/3] Instructions execution..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Pour executer les migrations:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Connectez-vous a Cloud SQL:" -ForegroundColor White
Write-Host "      gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Dans psql, executez le script temporaire:" -ForegroundColor White
Write-Host "      \i $tempSqlFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "   3. OU executez les migrations une par une:" -ForegroundColor White
foreach ($file in $migrationFiles | Select-Object -First 10) {
    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    Write-Host "      \i $relativePath" -ForegroundColor Cyan
}
if ($migrationFiles.Count -gt 10) {
    Write-Host "      ... et $($migrationFiles.Count - 10) autres migrations" -ForegroundColor Gray
}
Write-Host ""
Write-Host "   4. Verifier que les migrations ont ete appliquees:" -ForegroundColor White
Write-Host "      SELECT COUNT(*) FROM _sqlx_migrations;" -ForegroundColor Cyan
Write-Host "      SELECT version, description FROM _sqlx_migrations ORDER BY version LIMIT 10;" -ForegroundColor Cyan
Write-Host ""
Write-Host "   5. Supprimer le fichier temporaire apres execution:" -ForegroundColor White
Write-Host "      Remove-Item $tempSqlFile" -ForegroundColor Cyan
Write-Host ""

Write-Host "[OK] Instructions generees!" -ForegroundColor Green
Write-Host ""
Write-Host "Note:" -ForegroundColor Yellow
Write-Host "   Le script SQL temporaire ($tempSqlFile) a ete cree dans le repertoire actuel" -ForegroundColor White
Write-Host "   Vous pouvez l'utiliser pour executer toutes les migrations en une fois" -ForegroundColor White
Write-Host ""



