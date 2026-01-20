# Script pour appliquer la migration delivery_partners
$ErrorActionPreference = "Stop"

Write-Host "Application de la migration delivery_partners..." -ForegroundColor Cyan

# Lire DATABASE_URL depuis .env
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

$dbUrl = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^DATABASE_URL=(.+)$") {
        $dbUrl = $matches[1].Trim()
    }
}

if (-not $dbUrl) {
    Write-Host "DATABASE_URL non trouvee dans .env" -ForegroundColor Red
    exit 1
}

# Parser DATABASE_URL (format: postgresql://user:password@host:port/database ou postgresql://user:password@host/database)
if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)") {
    $user = $matches[1]
    $password = $matches[2]
    $dbHost = $matches[3]
    $port = if ($matches[4]) { $matches[4] } else { "5432" }
    $database = $matches[5]
    
    Write-Host "Connexion a: $dbHost`:$port/$database" -ForegroundColor Cyan
    
    # Exporter le mot de passe pour psql
    $env:PGPASSWORD = $password
    
    # Appliquer la migration
    $migrationFile = ".\migrations\20260104_apply_delivery_partners_migrations.sql"
    if (-not (Test-Path $migrationFile)) {
        Write-Host "Fichier de migration non trouve: $migrationFile" -ForegroundColor Red
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
    
    Write-Host "Application du fichier: $migrationFile" -ForegroundColor Cyan
    Write-Host ""
    
    psql -h $dbHost -p $port -U $user -d $database -f $migrationFile
    
    $result = $LASTEXITCODE
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    
    if ($result -eq 0) {
        Write-Host ""
        Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Erreur lors de l application de la migration (code: $result)" -ForegroundColor Red
        exit $result
    }
} else {
    Write-Host "Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Migration terminee!" -ForegroundColor Green
