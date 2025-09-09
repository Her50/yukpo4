# Script PowerShell pour exécuter le test GPS complet
# =================================================

Write-Host "Test GPS complet avec les parametres du frontend..." -ForegroundColor Cyan

# Lire la configuration depuis le fichier .env
$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
$dbHost = ""
$dbPort = ""
$dbName = ""
$dbUser = ""

foreach ($line in $envContent) {
    if ($line -match "^DATABASE_URL=") {
        $dbUrl = $line -replace "^DATABASE_URL=", ""
        if ($dbUrl -match "postgres://([^:]+):([^@]+)@([^:]+)/(.+)") {
            $dbUser = $matches[1]
            $dbPass = $matches[2]
            $dbHost = $matches[3]
            $dbPort = "5432"
            $dbName = $matches[4]
        }
    }
}

if (-not $dbHost -or -not $dbPort -or -not $dbName -or -not $dbUser) {
    Write-Host "Impossible de lire la configuration de la base de donnees depuis .env" -ForegroundColor Red
    Write-Host "Verifiez que le fichier .env contient DATABASE_URL=postgres://user:pass@host:port/db" -ForegroundColor Yellow
    exit 1
}

Write-Host "Configuration detectee:" -ForegroundColor Green
Write-Host "   Host: $dbHost" -ForegroundColor White
Write-Host "   Port: $dbPort" -ForegroundColor White
Write-Host "   Base: $dbName" -ForegroundColor White
Write-Host "   User: $dbUser" -ForegroundColor White

# Exécuter le test GPS
Write-Host "Execution du test GPS..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "test_gps_search_direct.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Test GPS termine avec succes!" -ForegroundColor Green
        Write-Host "Resultats du test:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "Erreur lors du test GPS:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Test termine!" -ForegroundColor Cyan 