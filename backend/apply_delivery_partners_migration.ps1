# Script pour appliquer la migration delivery_partners manuellement
# Usage: .\apply_delivery_partners_migration.ps1

Write-Host "🚀 Application de la migration delivery_partners..." -ForegroundColor Cyan

# Vérifier si DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL n'est pas définie dans l'environnement" -ForegroundColor Red
    Write-Host "💡 Définissez-la avec: `$env:DATABASE_URL = 'postgresql://user:password@host:port/database'" -ForegroundColor Yellow
    exit 1
}

# Extraire les informations de connexion depuis DATABASE_URL
$dbUrl = $env:DATABASE_URL

# Méthode 1: Utiliser psql si disponible
if (Get-Command psql -ErrorAction SilentlyContinue) {
    Write-Host "✅ Utilisation de psql pour appliquer la migration..." -ForegroundColor Green
    
    # Extraire les composants de l'URL
    if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
        $user = $matches[1]
        $password = $matches[2]
        $host = $matches[3]
        $port = $matches[4]
        $database = $matches[5]
        
        # Exporter le mot de passe pour psql
        $env:PGPASSWORD = $password
        
        Write-Host "📝 Connexion à la base de données: $host:$port/$database" -ForegroundColor Cyan
        
        # Appliquer la migration
        $migrationFile = Join-Path $PSScriptRoot "migrations\20260104_apply_delivery_partners_migrations.sql"
        
        if (Test-Path $migrationFile) {
            psql -h $host -p $port -U $user -d $database -f $migrationFile
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
            } else {
                Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
            exit 1
        }
        
        # Nettoyer
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
        exit 1
    }
}
# Méthode 2: Utiliser sqlx migrate si disponible
elseif (Get-Command sqlx -ErrorAction SilentlyContinue) {
    Write-Host "✅ Utilisation de sqlx migrate pour appliquer la migration..." -ForegroundColor Green
    
    Push-Location $PSScriptRoot
    sqlx migrate run
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}
# Méthode 3: Utiliser une connexion directe avec .NET (fallback)
else {
    Write-Host "⚠️ psql et sqlx ne sont pas disponibles" -ForegroundColor Yellow
    Write-Host "💡 Options:" -ForegroundColor Yellow
    Write-Host "   1. Installer PostgreSQL client (psql)" -ForegroundColor Yellow
    Write-Host "   2. Installer sqlx-cli: cargo install sqlx-cli" -ForegroundColor Yellow
    Write-Host "   3. Utiliser un client PostgreSQL (pgAdmin, DBeaver, etc.)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📄 Fichier de migration: migrations\20260104_apply_delivery_partners_migrations.sql" -ForegroundColor Cyan
    Write-Host "💡 Vous pouvez copier le contenu et l'exécuter dans votre client PostgreSQL" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Migration terminée!" -ForegroundColor Green



