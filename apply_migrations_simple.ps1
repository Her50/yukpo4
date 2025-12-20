# Simple script to apply specialized services migrations
$env:PGPASSWORD = "YOUR_PASSWORD"
$hostname = "your-render-db-host.render.com"
$database = "yukpo_db"
$username = "yukpo_db_user"

$migrations = @(
    "backend\migrations\20250127_create_hospital_advanced_tables.sql",
    "backend\migrations\20250127_create_pharmacy_advanced_tables.sql",
    "backend\migrations\20250127_create_lab_advanced_tables.sql"
)

foreach ($migration in $migrations) {
    Write-Host "Applying: $migration"
    if (Test-Path $migration) {
        $content = Get-Content $migration -Raw
        $content | psql -h $hostname -U $username -d $database
        Write-Host "Done: $migration" -ForegroundColor Green
    }
    else {
        Write-Host "File not found: $migration" -ForegroundColor Red
    }
}

Write-Host "All migrations completed!" -ForegroundColor Green

