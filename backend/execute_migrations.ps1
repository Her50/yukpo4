# Script pour exécuter les migrations directement sur la base de données
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
$dbUrl = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "🔧 Exécution des migrations directement sur la base de données..." -ForegroundColor Green

# Liste des migrations à exécuter dans l'ordre
$migrations = @(
    "migrations/20250128_002_add_pharmacy_products.sql",
    "migrations/20250127_create_pharmacy_advanced_tables.sql",
    "migrations/20250128_create_search_history_and_saved_searches.sql",
    "migrations/20250127_create_bourse_livre_advanced_tables.sql",
    "migrations/20250127_create_orientation_scolaire_advanced_tables.sql",
    "migrations/20250127_create_offres_emploi_advanced_tables.sql"
)

foreach ($migration in $migrations) {
    $migrationPath = Join-Path $PSScriptRoot $migration
    if (Test-Path $migrationPath) {
        Write-Host "📝 Exécution de $migration..." -ForegroundColor Yellow
        $content = Get-Content $migrationPath -Raw -Encoding UTF8
        $content | psql $dbUrl
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $migration exécutée avec succès" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Erreur lors de l'exécution de $migration (peut être déjà appliquée)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Fichier non trouvé: $migrationPath" -ForegroundColor Red
    }
}

Write-Host "✅ Toutes les migrations ont été exécutées" -ForegroundColor Green
