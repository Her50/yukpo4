# ✅ Script PowerShell pour appliquer la migration effects sur Render
# Usage: .\APPLY_MIGRATION_RENDER.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application de la migration effects sur Render..." -ForegroundColor Cyan

# Configuration
$DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$SQL_FILE = "APPLY_EFFECTS_MIGRATION_RENDER.sql"

# Vérifier que le fichier SQL existe
if (-not (Test-Path $SQL_FILE)) {
    Write-Host "❌ Erreur: Le fichier $SQL_FILE n'existe pas" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier SQL trouvé: $SQL_FILE" -ForegroundColor Green

# Vérifier si psql est disponible
$psqlPath = (Get-Command psql -ErrorAction SilentlyContinue).Source

if ($psqlPath) {
    Write-Host "✅ psql trouvé: $psqlPath" -ForegroundColor Green
    Write-Host "📝 Application de la migration..." -ForegroundColor Yellow
    
    try {
        # Appliquer la migration
        & psql $DATABASE_URL -f $SQL_FILE
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de l'application de la migration (code: $LASTEXITCODE)" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  psql n'est pas disponible sur ce système" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Instructions manuelles:" -ForegroundColor Cyan
    Write-Host "1. Installez PostgreSQL client (psql)" -ForegroundColor White
    Write-Host "2. Ou utilisez un client SQL (pgAdmin, DBeaver, etc.)" -ForegroundColor White
    Write-Host "3. Connectez-vous à la base avec l'URL:" -ForegroundColor White
    Write-Host "   $DATABASE_URL" -ForegroundColor Gray
    Write-Host "4. Exécutez le contenu de $SQL_FILE" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Alternative: Utiliser le SQL directement depuis le fichier $SQL_FILE" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Script terminé!" -ForegroundColor Green


