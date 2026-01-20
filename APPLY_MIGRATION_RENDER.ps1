# Application de la migration to_tsvector fix sur Render
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "Connexion a la base de donnees Render..." -ForegroundColor Cyan

# Parser l'URL
if ($DATABASE_URL -match "postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
    $user = $matches[1]
    $pass = $matches[2]
    $dbHost = $matches[3]
    $port = if ($matches[4]) { $matches[4] } else { "5432" }
    $db = $matches[5]
    
    Write-Host "Host: $dbHost" -ForegroundColor Yellow
    Write-Host "Database: $db" -ForegroundColor Yellow
    Write-Host "User: $user" -ForegroundColor Yellow
    Write-Host ""
    
    $migrationFile = "backend\migrations\20260114_fix_image_search_to_tsvector_error.sql"
    
    if (-not (Test-Path $migrationFile)) {
        Write-Host "Fichier non trouve: $migrationFile" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Application de la migration..." -ForegroundColor Cyan
    
    $env:PGPASSWORD = $pass
    Get-Content $migrationFile | psql -h $dbHost -p $port -U $user -d $db
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Erreur lors de l'application (code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}
