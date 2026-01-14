# Script simple pour appliquer la migration SQL directement
param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    if (Test-Path .env) {
        $envLine = Get-Content .env | Where-Object { $_ -match "^DATABASE_URL=" }
        if ($envLine) {
            $DatabaseUrl = ($envLine -replace "^DATABASE_URL=", "").Trim()
        }
    }
}

if (-not $DatabaseUrl) {
    Write-Host "❌ DATABASE_URL non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Application directe de la migration..." -ForegroundColor Cyan

# Extraire les composants de l'URL
if ($DatabaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "🔌 Connexion à ${dbHost}:${dbPort}/${dbName}" -ForegroundColor Cyan
    
    # Lire le fichier SQL
    $sqlFile = "migrations\20260114_optimize_delivery_queries_performance.sql"
    if (-not (Test-Path $sqlFile)) {
        Write-Host "❌ Fichier introuvable: $sqlFile" -ForegroundColor Red
        exit 1
    }
    
    $sqlContent = Get-Content $sqlFile -Raw
    
    # Essayer avec psql d'abord
    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) {
        Write-Host "✅ Utilisation de psql..." -ForegroundColor Green
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
        $sqlContent | Out-File -FilePath $tempFile -Encoding UTF8
        
        $env:PGPASSWORD = $dbPassword
        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $tempFile
        $exitCode = $LASTEXITCODE
        Remove-Item $tempFile -ErrorAction SilentlyContinue
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        
        if ($exitCode -eq 0) {
            Write-Host ""
            Write-Host "OK Migration appliquee avec succes!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host ""
            Write-Host "ERREUR lors de l'application" -ForegroundColor Red
            exit $exitCode
        }
    } else {
        Write-Host "⚠️ psql non disponible, utilisation de sqlx..." -ForegroundColor Yellow
        $env:DATABASE_URL = $DatabaseUrl
        sqlx migrate run
        if ($LASTEXITCODE -eq 0 -or ($LASTEXITCODE -ne 0 -and (sqlx migrate run 2>&1 | Select-String "migration 0"))) {
            Write-Host ""
            Write-Host "OK Migration appliquee (ou deja appliquee)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

