# Script simple pour exécuter les migrations avec sqlx-cli
$dbUrl = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "🔧 Exécution des migrations directement sur la base de données..." -ForegroundColor Green
Write-Host ""

$migrations = @(
    "migrations\20250128_002_add_pharmacy_products.sql",
    "migrations\20250127_create_pharmacy_advanced_tables.sql",
    "migrations\20250128_create_search_history_and_saved_searches.sql",
    "migrations\20250127_create_bourse_livre_advanced_tables.sql",
    "migrations\20250127_create_orientation_scolaire_advanced_tables.sql",
    "migrations\20250127_create_offres_emploi_advanced_tables.sql"
)

foreach ($migration in $migrations) {
    if (Test-Path $migration) {
        Write-Host "📝 Exécution de $migration..." -ForegroundColor Yellow
        $content = Get-Content $migration -Raw -Encoding UTF8
        $content | sqlx database execute --database-url $dbUrl 2>&1 | ForEach-Object {
            if ($_ -match "ERROR|error") {
                if ($_ -match "already exists|duplicate|relation.*already exists|trigger.*already exists") {
                    Write-Host "  ⚠️ Déjà existant (ignoré)" -ForegroundColor Yellow
                } else {
                    Write-Host "  ❌ $_" -ForegroundColor Red
                }
            } elseif ($_ -match "success|Success|OK") {
                Write-Host "  ✅ $_" -ForegroundColor Green
            } else {
                Write-Host "  $_"
            }
        }
        Write-Host ""
    } else {
        Write-Host "❌ Fichier non trouvé: $migration" -ForegroundColor Red
    }
}

Write-Host "✅ Toutes les migrations ont été exécutées" -ForegroundColor Green

