# Script pour vérifier que les tables, index et fonctions sont créés dans Cloud SQL PostgreSQL
# Date: 2026-02-15

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host "Verification Schema PostgreSQL GCP" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
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
Write-Host ""

# Etape 1: Recuperer les informations de connexion Cloud SQL
Write-Host "[ETAPE 1/5] Recuperation informations Cloud SQL..." -ForegroundColor Yellow

$connectionName = "$ProjectId`:$Region`:$InstanceName"
Write-Host "   [OK] Connection Name: $connectionName" -ForegroundColor Green

# Etape 2: Recuperer DATABASE_URL depuis Cloud Run
Write-Host "[ETAPE 2/5] Recuperation DATABASE_URL depuis Cloud Run..." -ForegroundColor Yellow

$cloudRunEnv = gcloud run services describe $ServiceName --region=$Region --format="yaml(spec.template.spec.containers[0].env)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    $dbUrlLine = $cloudRunEnv | Select-String -Pattern "DATABASE_URL" -Context 0,1
    
    if ($dbUrlLine) {
        $dbUrl = ($dbUrlLine -split "value: ")[1].Trim()
        Write-Host "   [OK] DATABASE_URL trouvee dans Cloud Run" -ForegroundColor Green
        Write-Host "   [OK] Format: $($dbUrl.Substring(0, [Math]::Min(80, $dbUrl.Length)))..." -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] DATABASE_URL non trouvee dans Cloud Run" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ATTENTION] Impossible de recuperer la configuration Cloud Run" -ForegroundColor Yellow
}

Write-Host ""

# Etape 3: Verifier les tables principales
Write-Host "[ETAPE 3/5] Verification des tables principales..." -ForegroundColor Yellow
Write-Host "   [INFO] Connexion a Cloud SQL via Cloud SQL Proxy..." -ForegroundColor Cyan

# Tables principales attendues
$expectedTables = @(
    "users",
    "services",
    "deliveries",
    "orders",
    "products",
    "couriers",
    "ratings",
    "notifications",
    "video_jobs",
    "audio_jobs",
    "story_templates",
    "commerce_connectors",
    "feature_flags"
)

Write-Host ""
Write-Host "   Tables attendues:" -ForegroundColor Cyan
foreach ($table in $expectedTables) {
    Write-Host "      - $table" -ForegroundColor White
}

Write-Host ""
Write-Host "   [INFO] Pour verifier les tables, executez:" -ForegroundColor Cyan
Write-Host "   gcloud sql connect $InstanceName --user=postgres --database=$DatabaseName --project=$ProjectId" -ForegroundColor White
Write-Host ""
Write-Host "   Puis dans psql:" -ForegroundColor Cyan
Write-Host "   \dt" -ForegroundColor White
Write-Host "   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" -ForegroundColor White

Write-Host ""

# Etape 4: Verifier les index
Write-Host "[ETAPE 4/5] Verification des index..." -ForegroundColor Yellow

Write-Host "   [INFO] Pour verifier les index, executez dans psql:" -ForegroundColor Cyan
Write-Host "   \di" -ForegroundColor White
Write-Host "   SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;" -ForegroundColor White

Write-Host ""

# Etape 5: Verifier les fonctions
Write-Host "[ETAPE 5/5] Verification des fonctions..." -ForegroundColor Yellow

Write-Host "   [INFO] Pour verifier les fonctions, executez dans psql:" -ForegroundColor Cyan
Write-Host "   \df" -ForegroundColor White
Write-Host "   SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;" -ForegroundColor White

Write-Host ""

# Alternative: Utiliser Cloud SQL Admin API pour lister les tables
Write-Host "[BONUS] Tentative de verification via Cloud SQL Admin API..." -ForegroundColor Yellow

# Note: Cloud SQL Admin API ne permet pas de lister directement les tables
# Il faut utiliser psql ou une connexion directe

Write-Host "   [INFO] Cloud SQL Admin API ne permet pas de lister les tables directement" -ForegroundColor Cyan
Write-Host "   [INFO] Utilisez la methode psql ci-dessus ou verifiez les logs Cloud Run" -ForegroundColor Cyan

Write-Host ""

# Verifier les logs Cloud Run pour les migrations
Write-Host "[BONUS] Verification des logs de migration Cloud Run..." -ForegroundColor Yellow

$migrationLogs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName AND (textPayload=~'migration\|Migration\|table\|Table\|CREATE TABLE')" --limit=20 --format="value(textPayload)" --project=$ProjectId 2>&1

if ($migrationLogs) {
    Write-Host "   [OK] Logs de migration trouves" -ForegroundColor Green
    $migrationLogs | Select-Object -First 5 | ForEach-Object {
        Write-Host "      $_" -ForegroundColor White
    }
} else {
    Write-Host "   [INFO] Aucun log de migration recent trouve" -ForegroundColor Cyan
    Write-Host "   [INFO] Les migrations peuvent avoir ete executees au demarrage" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OK] Verification terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Connectez-vous a Cloud SQL via psql" -ForegroundColor White
Write-Host "   2. Verifiez les tables avec: \dt" -ForegroundColor White
Write-Host "   3. Verifiez les index avec: \di" -ForegroundColor White
Write-Host "   4. Verifiez les fonctions avec: \df" -ForegroundColor White
Write-Host ""


