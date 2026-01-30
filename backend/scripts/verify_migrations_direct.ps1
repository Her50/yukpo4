# Script pour vérifier directement l'état des migrations dans la base de données
# Usage: .\backend\scripts\verify_migrations_direct.ps1

Write-Host "🔍 ========== VÉRIFICATION DIRECTE DES MIGRATIONS ==========" -ForegroundColor Cyan
Write-Host ""

# Récupérer DATABASE_URL depuis l'environnement
$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL non trouvé dans les variables d'environnement" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Options:" -ForegroundColor Yellow
    Write-Host "  1. Définir DATABASE_URL dans PowerShell:" -ForegroundColor Gray
    Write-Host "     `$env:DATABASE_URL = 'postgresql://user:pass@host:5432/db'" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  2. Utiliser le script SQL directement:" -ForegroundColor Gray
    Write-Host "     psql `$DATABASE_URL -f backend/scripts/check_migration_status.sql" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  3. Vérifier dans .env ou les variables d'environnement système" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ DATABASE_URL trouvé" -ForegroundColor Green
Write-Host ""

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ psql (PostgreSQL client) non trouvé dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Installez PostgreSQL client ou utilisez Docker:" -ForegroundColor Yellow
    Write-Host "   docker run -it --rm postgres:15 psql `$DATABASE_URL -f - < backend/scripts/check_migration_status.sql" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ psql trouvé: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Exécuter le script SQL
Write-Host "📊 Exécution de la vérification..." -ForegroundColor Yellow
Write-Host ""

$scriptPath = Join-Path $PSScriptRoot "check_migration_status.sql"

if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Script SQL non trouvé: $scriptPath" -ForegroundColor Red
    exit 1
}

try {
    # Exécuter le script SQL
    $output = & psql $databaseUrl -f $scriptPath 2>&1
    
    # Afficher la sortie
    $output | ForEach-Object {
        if ($_ -match "✅|EXISTE|successful|correcte") {
            Write-Host $_ -ForegroundColor Green
        } elseif ($_ -match "❌|MANQUANTE|failed|inattendue") {
            Write-Host $_ -ForegroundColor Red
        } elseif ($_ -match "⚠️|WARNING") {
            Write-Host $_ -ForegroundColor Yellow
        } else {
            Write-Host $_
        }
    }
    
    Write-Host ""
    Write-Host "✅ Vérification terminée" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Vérifiez:" -ForegroundColor Yellow
    Write-Host "  - Que DATABASE_URL est correct" -ForegroundColor Gray
    Write-Host "  - Que la base de données est accessible" -ForegroundColor Gray
    Write-Host "  - Que vous avez les permissions nécessaires" -ForegroundColor Gray
    exit 1
}


