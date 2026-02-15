# Script complet pour vérifier les tables, index et fonctions dans Cloud SQL PostgreSQL
# Date: 2026-02-15

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Verification Schema PostgreSQL GCP (Complet)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
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

# Etape 1: Verifier que le script SQL existe
Write-Host "[ETAPE 1/3] Verification du script SQL..." -ForegroundColor Yellow

$sqlScript = "scripts\verifier-schema-postgres-sql.sql"
if (Test-Path $sqlScript) {
    Write-Host "   [OK] Script SQL trouve: $sqlScript" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Script SQL non trouve: $sqlScript" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 2: Instructions pour se connecter
Write-Host "[ETAPE 2/3] Instructions de connexion..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Pour verifier le schema, executez:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor White
Write-Host ""
Write-Host "   Puis dans psql, executez:" -ForegroundColor Cyan
Write-Host "   \i $sqlScript" -ForegroundColor White
Write-Host ""
Write-Host "   OU copiez-collez le contenu du script SQL dans psql" -ForegroundColor Cyan
Write-Host ""

# Etape 3: Alternative - Utiliser Cloud SQL Admin API (limite)
Write-Host "[ETAPE 3/3] Alternative - Verification via logs Cloud Run..." -ForegroundColor Yellow

$serviceName = "yukpo-backend"
Write-Host "   [INFO] Recherche des logs de migration dans Cloud Run..." -ForegroundColor Cyan

# Rechercher les logs de migration
$migrationLogs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$serviceName AND (textPayload=~'migration|Migration|table|Table|CREATE TABLE|CREATE INDEX|CREATE FUNCTION')" --limit=30 --format="value(textPayload)" --project=$ProjectId 2>&1

if ($migrationLogs -and $migrationLogs.Count -gt 0) {
    Write-Host "   [OK] Logs de migration trouves" -ForegroundColor Green
    Write-Host ""
    $migrationLogs | Select-Object -First 10 | ForEach-Object {
        if ($_ -match "migration|Migration|table|Table|CREATE") {
            Write-Host "      $_" -ForegroundColor White
        }
    }
} else {
    Write-Host "   [INFO] Aucun log de migration recent trouve" -ForegroundColor Yellow
    Write-Host "   [INFO] Les migrations peuvent avoir ete executees au demarrage" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OK] Instructions generees!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Connectez-vous a Cloud SQL avec la commande ci-dessus" -ForegroundColor White
Write-Host "   2. Executez le script SQL pour verifier le schema complet" -ForegroundColor White
Write-Host "   3. Verifiez que toutes les tables, index et fonctions sont crees" -ForegroundColor White
Write-Host ""

