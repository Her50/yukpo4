Write-Host "Checking PostgreSQL services directly..."

# Vérifier si psql est disponible
try {
    $psqlVersion = & psql --version 2>$null
    Write-Host "PostgreSQL client found: $psqlVersion"
} catch {
    Write-Host "PostgreSQL client not found. Please install psql or use pgAdmin."
    exit 1
}

# Requête simple pour compter les services
Write-Host "`nExecuting SQL queries..."

try {
    # Compter tous les services
    $countQuery = "SELECT COUNT(*) as total FROM services;"
    $totalCount = & psql -h localhost -U postgres -d yukpomnang -t -c $countQuery 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Total services in PostgreSQL: $($totalCount.Trim())"
    } else {
        Write-Host "Error connecting to PostgreSQL"
    }
    
    # Compter les services actifs
    $activeQuery = "SELECT COUNT(*) as active FROM services WHERE is_active = true;"
    $activeCount = & psql -h localhost -U postgres -d yukpomnang -t -c $activeQuery 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Active services in PostgreSQL: $($activeCount.Trim())"
    }
    
    # Vérifier les IDs spécifiques
    $specificIds = @(27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614)
    Write-Host "`nChecking specific IDs from logs:"
    
    foreach ($id in $specificIds) {
        $checkQuery = "SELECT id, category, is_active FROM services WHERE id = $id;"
        $result = & psql -h localhost -U postgres -d yukpomnang -t -c $checkQuery 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $result.Trim() -ne "") {
            Write-Host "  ✅ ID $id found in PostgreSQL: $($result.Trim())"
        } else {
            Write-Host "  ❌ ID $id NOT found in PostgreSQL"
        }
    }
    
} catch {
    Write-Host "Error: $_"
}

Write-Host "`nNote: If you get connection errors, make sure PostgreSQL is running and accessible." 