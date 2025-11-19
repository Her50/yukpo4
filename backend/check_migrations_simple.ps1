# Script simple pour vérifier les migrations
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "=== VÉRIFICATION DES MIGRATIONS ===" -ForegroundColor Cyan

# 1. Compter les migrations locales
$localMigrations = Get-ChildItem -Path "migrations" -Filter "*.sql" -ErrorAction SilentlyContinue
Write-Host "`n📁 Migrations locales: $($localMigrations.Count)" -ForegroundColor Green

# 2. Vérifier .sqlx
if (Test-Path ".sqlx") {
    Write-Host "✅ Cache .sqlx existe" -ForegroundColor Green
} else {
    Write-Host "❌ Cache .sqlx manquant" -ForegroundColor Red
}

# 3. Vérifier avec sqlx-cli si disponible
$sqlxCmd = Get-Command sqlx -ErrorAction SilentlyContinue
if ($sqlxCmd) {
    Write-Host "`n🔍 Vérification avec sqlx migrate info..." -ForegroundColor Cyan
    $env:DATABASE_URL = $DATABASE_URL
    sqlx migrate info
} else {
    Write-Host "`n⚠️  sqlx-cli non installé" -ForegroundColor Yellow
    Write-Host "   Installer: cargo install sqlx-cli --no-default-features --features postgres" -ForegroundColor Yellow
}

Write-Host "`n=== FIN ===" -ForegroundColor Cyan

