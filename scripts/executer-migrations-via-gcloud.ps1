# Script pour exécuter les migrations SQLx via gcloud sql connect
# Date: 2026-02-15
# Objectif: Exécuter les migrations SQLx en utilisant gcloud sql connect (pas besoin de mot de passe)

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Execution Migrations SQLx via gcloud sql connect" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
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

# Etape 2: Creer un script SQL pour executer toutes les migrations
Write-Host "[ETAPE 2/3] Creation script SQL temporaire..." -ForegroundColor Yellow

$tempSqlFile = "temp_execute_migrations.sql"
$sqlContent = @"
-- Script temporaire pour executer toutes les migrations SQLx
-- Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

-- Creer la table _sqlx_migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    checksum BYTEA NOT NULL,
    execution_time BIGINT NOT NULL
);

-- Afficher l'etat actuel
SELECT 'Migrations actuelles: ' || COUNT(*)::TEXT FROM _sqlx_migrations;

"@

# Ajouter chaque migration
foreach ($file in $migrationFiles) {
    $fileContent = Get-Content $file.FullName -Raw -Encoding UTF8
    $fileName = $file.Name
    
    $sqlContent += @"

-- ============================================
-- Migration: $fileName
-- ============================================
$fileContent

"@
}

# Ajouter verification finale
$sqlContent += @"

-- Verification finale
SELECT 'Migrations apres execution: ' || COUNT(*)::TEXT FROM _sqlx_migrations;
SELECT version, description, installed_on 
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 10;

"@

$sqlContent | Out-File -FilePath $tempSqlFile -Encoding UTF8
Write-Host "   [OK] Script SQL temporaire cree: $tempSqlFile" -ForegroundColor Green
Write-Host "   [INFO] Taille: $((Get-Item $tempSqlFile).Length / 1KB) KB" -ForegroundColor Cyan
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
Write-Host "   3. OU copiez-collez le contenu du fichier dans psql" -ForegroundColor White
Write-Host ""
Write-Host "   4. Apres execution, supprimez le fichier temporaire:" -ForegroundColor White
Write-Host "      Remove-Item $tempSqlFile" -ForegroundColor Cyan
Write-Host ""

# Option alternative: Utiliser psql directement si disponible
Write-Host "   ALTERNATIVE: Si vous avez psql installe localement:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Recuperez l'IP publique:" -ForegroundColor White
$publicIp = gcloud sql instances describe $InstanceName --format="get(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0 -and $publicIp) {
    Write-Host "      IP publique: $publicIp" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   2. Connectez-vous avec psql:" -ForegroundColor White
    Write-Host "      psql -h $publicIp -U $User -d $DatabaseName -f $tempSqlFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "      (Vous serez demande le mot de passe)" -ForegroundColor Gray
} else {
    Write-Host "      [ATTENTION] Impossible de recuperer l'IP publique" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[OK] Instructions generees!" -ForegroundColor Green
Write-Host ""
Write-Host "Note:" -ForegroundColor Yellow
Write-Host "   Le script SQL temporaire ($tempSqlFile) contient toutes les migrations" -ForegroundColor White
Write-Host "   Il sera execute dans l'ordre pour creer toutes les tables" -ForegroundColor White
Write-Host ""



