# Script PowerShell pour appliquer toutes les migrations templates
# Usage: .\backend\scripts\apply_all_templates_migrations.ps1

$dbUrl = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

$migrations = @(
    "backend\migrations\20250127_005_enrich_templates_ecommerce_200.sql",
    "backend\migrations\20250127_006_enrich_templates_ecommerce_150.sql",
    "backend\migrations\20250127_007_enrich_templates_services_200.sql",
    "backend\migrations\20250127_008_enrich_templates_creators_200.sql",
    "backend\migrations\20250127_009_enrich_templates_business_200.sql",
    "backend\migrations\20250127_010_enrich_templates_social_media_200.sql",
    "backend\migrations\20250127_011_enrich_templates_restaurant_110.sql"
)

Write-Host "🚀 Application de toutes les migrations templates..." -ForegroundColor Cyan
Write-Host ""

$totalApplied = 0

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "📦 Application: $migration" -ForegroundColor Blue
        Get-Content $migration | psql $dbUrl 2>&1 | Out-Null
        $totalApplied++
        Write-Host "   ✅ Appliquée" -ForegroundColor Green
    }
    else {
        Write-Host "   ⚠️  Fichier non trouvé: $migration" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ $totalApplied migrations appliquées" -ForegroundColor Green
Write-Host ""
Write-Host "Vérification du comptage..." -ForegroundColor Cyan
$query = "SELECT COUNT(*) as total_templates FROM video_templates;"
$query | psql $dbUrl 2>&1

