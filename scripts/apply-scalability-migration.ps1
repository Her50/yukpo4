# ✅ Script PowerShell pour appliquer la migration de scalabilité sur Render DB

$ErrorActionPreference = "Stop"

# ✅ Configuration de la base de données Render
$DB_HOST = "your-render-db-host.render.com"
$DB_NAME = "yukpo_db"
$DB_USER = "yukpo_db_user"
$DB_PASSWORD = "YOUR_PASSWORD"
$DB_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}"

Write-Host "🚀 Application de la migration de scalabilité sur Render DB" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host "Host: $DB_HOST"
Write-Host "Database: $DB_NAME"
Write-Host "User: $DB_USER"
Write-Host ""

# ✅ Vérifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ psql n'est pas installé" -ForegroundColor Red
    Write-Host "   Installer PostgreSQL client: https://www.postgresql.org/download/"
    exit 1
}

# ✅ Vérifier la connexion
Write-Host "🔍 Vérification de la connexion..." -ForegroundColor Yellow
try {
    $result = & psql $DB_URL -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Échec de la connexion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

# ✅ Appliquer la migration
Write-Host ""
Write-Host "📦 Application de la migration 20250101_scalability_improvements.sql..." -ForegroundColor Yellow

$migrationFile = "backend\migrations\20250101_scalability_improvements.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration non trouvé: $migrationFile" -ForegroundColor Red
    exit 1
}

& psql $DB_URL -f $migrationFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔍 Vérification des objets créés..." -ForegroundColor Yellow
    
    # ✅ Vérifier les tables
    Write-Host ""
    Write-Host "Tables créées:" -ForegroundColor Cyan
    & psql $DB_URL -c "\dt video_generation_metrics rate_limit_tracking studio_session_cache" 2>&1 | Out-Null
    
    # ✅ Vérifier les index
    Write-Host ""
    Write-Host "Index créés (exemples):" -ForegroundColor Cyan
    & psql $DB_URL -c "\di idx_video_jobs_status_created idx_video_jobs_user_status" 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "✅ Migration complète!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
    exit 1
}

