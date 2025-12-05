# Apply specialized services migrations to Render database
$ErrorActionPreference = "Continue"

$DB_HOST = "dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com"
$DB_NAME = "yukpo_db"
$DB_USER = "yukpo_db_user"
$DB_PASS = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"

Write-Host "=== Applying Specialized Services Migrations ===" -ForegroundColor Cyan
Write-Host "Database: $DB_NAME on $DB_HOST" -ForegroundColor Gray
Write-Host ""

$env:PGPASSWORD = $DB_PASS

$migrations = @(
    "backend/migrations/20250127_create_hospital_advanced_tables.sql",
    "backend/migrations/20250127_create_pharmacy_advanced_tables.sql",
    "backend/migrations/20250127_create_lab_advanced_tables.sql"
)

$success = 0
$failed = 0

foreach ($migration in $migrations) {
    $name = Split-Path $migration -Leaf
    Write-Host "[$($success + $failed + 1)/$($migrations.Count)] Applying: $name" -ForegroundColor Yellow
    
    if (-not (Test-Path $migration)) {
        Write-Host "  ERROR: File not found!" -ForegroundColor Red
        $failed++
        continue
    }
    
    try {
        $migrationPath = (Resolve-Path $migration).Path
        $result = & psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $migrationPath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  SUCCESS: Applied successfully!" -ForegroundColor Green
            $success++
        }
        else {
            Write-Host "  ERROR: Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
            if ($result) {
                Write-Host $result -ForegroundColor DarkRed
            }
            $failed++
        }
    }
    catch {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
    Write-Host ""
}

Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $success/$($migrations.Count)" -ForegroundColor Green
Write-Host "Failed: $failed/$($migrations.Count)" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "All migrations applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Create AI services" -ForegroundColor Gray
    Write-Host "  2. Create backend endpoints" -ForegroundColor Gray
    Write-Host "  3. Improve frontend screens" -ForegroundColor Gray
    exit 0
}
else {
    Write-Host ""
    Write-Host "Some migrations failed. Please check errors above." -ForegroundColor Red
    exit 1
}
