# Script PowerShell pour le nettoyage final des anciennes fonctions
# ===============================================================

Write-Host "Nettoyage final des anciennes fonctions GPS..." -ForegroundColor Cyan

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

# Nettoyage final
Write-Host "Execution du nettoyage final..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    
    # Supprimer les anciennes fonctions avec search_text
    $dropCommands = @(
        "DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer) CASCADE;",
        "DROP FUNCTION IF EXISTS fast_gps_search_with_user_fallback(text, text, integer) CASCADE;",
        "DROP FUNCTION IF EXISTS fast_text_gps_search_with_user_fallback(text, text, integer) CASCADE;"
    )
    
    foreach ($command in $dropCommands) {
        Write-Host "Execution: $command" -ForegroundColor Yellow
        $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c $command 2>&1
        Write-Host "Resultat: $result" -ForegroundColor White
    }
    
    Write-Host "Nettoyage final termine avec succes!" -ForegroundColor Green
    
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Nettoyage final termine!" -ForegroundColor Cyan 