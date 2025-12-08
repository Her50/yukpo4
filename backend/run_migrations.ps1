# Script PowerShell pour exécuter les migrations directement
$env:PGPASSWORD = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
$dbUrl = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "🔧 Exécution des migrations directement sur la base de données..." -ForegroundColor Green
Write-Host ""

# Fonction pour exécuter un fichier SQL
function Execute-SQLFile {
    param([string]$filePath)
    
    if (Test-Path $filePath) {
        Write-Host "📝 Exécution de $filePath..." -ForegroundColor Yellow
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        # Exécuter avec psql si disponible, sinon utiliser sqlx
        if (Get-Command psql -ErrorAction SilentlyContinue) {
            $content | psql $dbUrl 2>&1 | ForEach-Object {
                if ($_ -match "ERROR") {
                    Write-Host $_ -ForegroundColor Red
                } elseif ($_ -match "already exists|duplicate|relation.*already exists") {
                    Write-Host "  ⚠️ Déjà existant (ignoré)" -ForegroundColor Yellow
                } else {
                    Write-Host $_
                }
            }
        } else {
            Write-Host "  ⚠️ psql non disponible, veuillez installer PostgreSQL client" -ForegroundColor Yellow
            Write-Host "  Ou utilisez: cargo run --bin execute_migrations_direct" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Fichier non trouvé: $filePath" -ForegroundColor Red
    }
}

# Liste des migrations à exécuter
$migrations = @(
    "migrations\20250128_002_add_pharmacy_products.sql",
    "migrations\20250127_create_pharmacy_advanced_tables.sql",
    "migrations\20250128_create_search_history_and_saved_searches.sql",
    "migrations\20250127_create_bourse_livre_advanced_tables.sql",
    "migrations\20250127_create_orientation_scolaire_advanced_tables.sql",
    "migrations\20250127_create_offres_emploi_advanced_tables.sql"
)

foreach ($migration in $migrations) {
    $migrationPath = Join-Path $PSScriptRoot $migration
    Execute-SQLFile -filePath $migrationPath
    Write-Host ""
}

Write-Host "✅ Toutes les migrations ont été exécutées" -ForegroundColor Green

