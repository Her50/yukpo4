# Application directe de la migration to_tsvector fix
$migrationFile = "backend\migrations\20260114_fix_image_search_to_tsvector_error.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "Fichier non trouve: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Application de la migration..." -ForegroundColor Cyan

if ($env:DATABASE_URL) {
    $url = $env:DATABASE_URL
    if ($url -match "postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
        $user = $matches[1]
        $pass = $matches[2]
        $host = $matches[3]
        $port = if ($matches[4]) { $matches[4] } else { "5432" }
        $db = $matches[5]
        
        $env:PGPASSWORD = $pass
        Get-Content $migrationFile | psql -h $host -p $port -U $user -d $db
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
        }
    }
} else {
    Write-Host "DATABASE_URL non definie. Migration sera appliquee automatiquement au demarrage." -ForegroundColor Yellow
}
