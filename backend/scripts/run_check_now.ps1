# Script temporaire pour vérifier les migrations
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "🔍 Connexion à la base de données..." -ForegroundColor Cyan
Write-Host ""

$scriptPath = Join-Path $PSScriptRoot "quick_check_tables.sql"

if (Test-Path $scriptPath) {
    try {
        $output = & psql $env:DATABASE_URL -f $scriptPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $output
            Write-Host ""
            Write-Host "✅ Vérification terminée" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de la connexion" -ForegroundColor Red
            Write-Host $output
        }
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Script SQL non trouvé: $scriptPath" -ForegroundColor Red
}






