# 🔍 Script PowerShell pour diagnostic recherche et vérification produit Toyota Avensis 200
# Base de données Render PostgreSQL

$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
$DB_HOST = "dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com"
$DB_PORT = "5432"
$DB_NAME = "yukpo_db"
$DB_USER = "yukpo_db_user"

$PSQL_CMD = "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

Write-Host "🔍 Diagnostic de la recherche et vérification du produit Toyota Avensis 200" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "1️⃣ Vérification du produit dans services.data..." -ForegroundColor Yellow
& $PSQL_CMD -f "scripts/check_toyota_avensis.sql"

Write-Host ""
Write-Host "2️⃣ Diagnostic performance recherche..." -ForegroundColor Yellow
& $PSQL_CMD -f "scripts/diagnostic_recherche.sql"

Write-Host ""
Write-Host "✅ Diagnostic terminé !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Pour réindexer les produits manquants, exécutez:" -ForegroundColor Cyan
Write-Host "   .\scripts\run_diagnostic.ps1 -FixMissing" -ForegroundColor Cyan

