# Script PowerShell pour vérifier l'état actuel des fonctions GPS
# ================================================================

Write-Host "🔍 Vérification de l'état actuel des fonctions GPS..." -ForegroundColor Cyan

# Lire la configuration depuis le fichier .env
$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
$dbHost = ""
$dbPort = ""
$dbName = ""
$dbUser = ""

foreach ($line in $envContent) {
    if ($line -match "^DATABASE_URL=") {
        $dbUrl = $line -replace "^DATABASE_URL=", ""
        if ($dbUrl -match "postgres://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $dbUser = $matches[1]
            $dbPass = $matches[2]
            $dbHost = $matches[3]
            $dbPort = $matches[4]
            $dbName = $matches[5]
        }
    }
}

if (-not $dbHost -or -not $dbPort -or -not $dbName -or -not $dbUser) {
    Write-Host "❌ Impossible de lire la configuration de la base de données depuis .env" -ForegroundColor Red
    Write-Host "Vérifiez que le fichier .env contient DATABASE_URL=postgres://user:pass@host:port/db" -ForegroundColor Yellow
    exit 1
}

Write-Host "📊 Configuration détectée:" -ForegroundColor Green
Write-Host "   Host: $dbHost" -ForegroundColor White
Write-Host "   Port: $dbPort" -ForegroundColor White
Write-Host "   Base: $dbName" -ForegroundColor White
Write-Host "   User: $dbUser" -ForegroundColor White

# Exécuter le script SQL de vérification
Write-Host "`n🚀 Exécution de la vérification GPS..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "verifier_etat_gps.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Vérification GPS terminée avec succès!" -ForegroundColor Green
        Write-Host "`n📋 Résultats de la vérification:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de la vérification GPS:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de l'exécution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    # Nettoyer le mot de passe de l'environnement
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`n🏁 Vérification terminée!" -ForegroundColor Cyan 