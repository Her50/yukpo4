$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$env:DATABASE_URL = $DATABASE_URL

Write-Host "1. Correction du checksum..." -ForegroundColor Yellow
psql "$DATABASE_URL" -f fix_checksum.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n2. Application des migrations..." -ForegroundColor Yellow
    cargo sqlx migrate run
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n3. Verification..." -ForegroundColor Yellow
        cargo sqlx migrate info | Select-String "pending"
    }
}

