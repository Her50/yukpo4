# Script PowerShell pour appliquer les fonctions GPS corrigées
# =========================================================

Write-Host "Application des fonctions GPS corrigees..." -ForegroundColor Cyan

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

# Appliquer les fonctions GPS corrigées
Write-Host "Application des fonctions GPS corrigees..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "create_clean_gps_functions_fixed.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Fonctions GPS corrigees appliquees avec succes!" -ForegroundColor Green
        Write-Host "Resultats de la creation:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "Erreur lors de l'application des fonctions GPS corrigees:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Application des fonctions GPS corrigees terminee!" -ForegroundColor Cyan 