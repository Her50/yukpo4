# Script PowerShell pour diagnostiquer l'appel de la fonction GPS
# =============================================================

Write-Host "Diagnostic de l'appel de la fonction GPS..." -ForegroundColor Cyan

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
    exit 1
}

Write-Host "Configuration detectee:" -ForegroundColor Green
Write-Host "   Host: $dbHost" -ForegroundColor White
Write-Host "   Port: $dbPort" -ForegroundColor White
Write-Host "   Base: $dbName" -ForegroundColor White
Write-Host "   User: $dbUser" -ForegroundColor White

# Exécuter le diagnostic
Write-Host "Execution du diagnostic..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "diagnostic_appel_fonction.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Diagnostic termine avec succes!" -ForegroundColor Green
        Write-Host "Resultats du diagnostic:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "Erreur lors du diagnostic:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Diagnostic termine!" -ForegroundColor Cyan 