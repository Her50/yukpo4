# Script PowerShell to apply specialized services migrations on Render
# Date: 2025-01-27
# Migrations: Advanced tables for Hospitals, Pharmacies, Laboratories

Write-Host "=== Applying Specialized Services Migrations ===" -ForegroundColor Cyan
Write-Host "Render Database - Advanced Tables" -ForegroundColor Green
Write-Host ""

# Render database connection
$DATABASE_URL = "postgresql://user:password@host:port/database"

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql is not available in PATH" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "Connecting to Render database..." -ForegroundColor Blue
Write-Host "Host: your-render-db-host.render.com" -ForegroundColor Gray
Write-Host "Database: yukpo_db" -ForegroundColor Gray
Write-Host ""

# List of migrations to apply in order
$migrations = @(
    @{
        File = "backend\migrations\20250127_create_hospital_advanced_tables.sql"
        Name = "Hospital Advanced Tables"
    },
    @{
        File = "backend\migrations\20250127_create_pharmacy_advanced_tables.sql"
        Name = "Pharmacy Advanced Tables"
    },
    @{
        File = "backend\migrations\20250127_create_lab_advanced_tables.sql"
        Name = "Laboratory Advanced Tables"
    }
)

$successCount = 0
$errorCount = 0

foreach ($migration in $migrations) {
    $migrationFile = $migration.File
    $migrationName = $migration.Name
    
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[$($successCount + $errorCount + 1)/$($migrations.Count)] $migrationName" -ForegroundColor Yellow
    Write-Host ""
    
    # Check if file exists
    if (-not (Test-Path $migrationFile)) {
        Write-Host "  ERROR: File not found: $migrationFile" -ForegroundColor Red
        $errorCount++
        continue
    }
    
    Write-Host "  -> Applying migration..." -ForegroundColor Cyan
    
    try {
        # Execute migration via psql with file
        & psql $DATABASE_URL -f $migrationFile 2>&1 | Out-String | Write-Host
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  SUCCESS: Migration applied successfully!" -ForegroundColor Green
            $successCount++
        }
        else {
            Write-Host "  ERROR: Failed to apply migration (exit code: $LASTEXITCODE)" -ForegroundColor Red
            $errorCount++
        }
    }
    catch {
        Write-Host "  ERROR: Exception occurred:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        $errorCount++
    }
    
    Write-Host ""
}

Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Summary
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "SUCCESS: $successCount/$($migrations.Count)" -ForegroundColor Green
if ($errorCount -gt 0) {
    Write-Host "ERRORS: $errorCount/$($migrations.Count)" -ForegroundColor Red
}

if ($errorCount -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS: All migrations applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Create AI services" -ForegroundColor Gray
    Write-Host "  2. Create backend endpoints" -ForegroundColor Gray
    Write-Host "  3. Improve frontend screens" -ForegroundColor Gray
    Write-Host ""
    exit 0
}
else {
    Write-Host ""
    Write-Host "ERROR: Some migrations failed. Please check errors above." -ForegroundColor Red
    Write-Host ""
    exit 1
}
