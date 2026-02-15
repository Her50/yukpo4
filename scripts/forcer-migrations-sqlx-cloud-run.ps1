# Script pour forcer l'exécution des migrations SQLx sur Cloud Run
# Date: 2026-02-15
# Note: Les migrations SQLx ne s'exécutent PAS automatiquement sur Cloud Run
# Ce script permet de les exécuter manuellement

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user"
)

Write-Host "Forcer Migrations SQLx Cloud Run" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
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
Write-Host "ATTENTION:" -ForegroundColor Yellow
Write-Host "   Les migrations SQLx ne s'executent PAS automatiquement sur Cloud Run" -ForegroundColor Yellow
Write-Host "   (code: if !is_cloud_run dans main.rs)" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Options:" -ForegroundColor Cyan
Write-Host "   1. Executer les migrations manuellement via psql" -ForegroundColor White
Write-Host "   2. Modifier le code pour executer les migrations sur Cloud Run" -ForegroundColor White
Write-Host "   3. Utiliser un job Cloud Run pour executer les migrations" -ForegroundColor White
Write-Host ""

# Option 1: Instructions pour executer via psql
Write-Host "[OPTION 1] Execution manuelle via psql..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Connectez-vous a Cloud SQL:" -ForegroundColor Cyan
Write-Host "      gcloud sql connect $InstanceName --user=$User --database=$DatabaseName --project=$ProjectId" -ForegroundColor White
Write-Host ""
Write-Host "   2. Dans psql, executez les migrations SQLx:" -ForegroundColor Cyan
Write-Host "      -- Les migrations sont dans backend/migrations/" -ForegroundColor White
Write-Host "      -- Executez-les dans l'ordre numerique" -ForegroundColor White
Write-Host ""

# Option 2: Creer un job Cloud Run pour executer les migrations
Write-Host "[OPTION 2] Job Cloud Run pour migrations..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Creer un job Cloud Run qui execute:" -ForegroundColor Cyan
Write-Host "   cargo sqlx migrate run" -ForegroundColor White
Write-Host ""

# Option 3: Modifier le code pour executer les migrations sur Cloud Run
Write-Host "[OPTION 3] Modifier le code..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Dans backend/src/main.rs, ligne ~596:" -ForegroundColor Cyan
Write-Host "   Changer: if !is_cloud_run" -ForegroundColor White
Write-Host "   En: if true  (pour executer sur Cloud Run aussi)" -ForegroundColor White
Write-Host "   OU creer une variable d'environnement: ENABLE_SQLX_MIGRATIONS=true" -ForegroundColor White
Write-Host ""

# Verifier l'etat actuel
Write-Host "[VERIFICATION] Etat actuel..." -ForegroundColor Yellow

$cloudRunEnv = gcloud run services describe $ServiceName --region=$Region --format="yaml(spec.template.spec.containers[0].env)" --project=$ProjectId 2>&1

$enableAutoMigrations = $cloudRunEnv | Select-String -Pattern "ENABLE_AUTO_MIGRATIONS" -Context 0,1
$cloudRun = $cloudRunEnv | Select-String -Pattern "CLOUD_RUN" -Context 0,1

Write-Host ""
if ($enableAutoMigrations) {
    Write-Host "   [OK] ENABLE_AUTO_MIGRATIONS trouve" -ForegroundColor Green
    Write-Host "   $enableAutoMigrations" -ForegroundColor White
} else {
    Write-Host "   [ATTENTION] ENABLE_AUTO_MIGRATIONS non trouve" -ForegroundColor Yellow
}

if ($cloudRun) {
    Write-Host "   [OK] CLOUD_RUN trouve" -ForegroundColor Green
    Write-Host "   $cloudRun" -ForegroundColor White
} else {
    Write-Host "   [ATTENTION] CLOUD_RUN non trouve" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[RECOMMANDATION]" -ForegroundColor Cyan
Write-Host "   Pour verifier que les tables existent, connectez-vous a Cloud SQL" -ForegroundColor White
Write-Host "   et executez le script: scripts\verifier-schema-postgres-sql.sql" -ForegroundColor White
Write-Host ""

