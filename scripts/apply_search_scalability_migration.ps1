# Script pour appliquer la migration de scalabilité de recherche sur Render
# Usage: .\scripts\apply_search_scalability_migration.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application de la migration de scalabilité de recherche..." -ForegroundColor Cyan

# Configuration de la base de données Render
$DATABASE_URL = "postgresql://user:password@host:port/database"

# Chemin vers la migration
$MIGRATION_FILE = "backend\migrations\20251202_search_scalability_improvements.sql"

# Vérifier que le fichier existe
if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Erreur: Fichier de migration introuvable: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Fichier de migration: $MIGRATION_FILE" -ForegroundColor Green

# Extraire les informations de connexion
$regexPattern = 'postgresql://([^:]+):([^@]+)@([^/]+)/(.+)'
if ($DATABASE_URL -match $regexPattern) {
    $DB_USER = $matches[1]
    $DB_PASS = $matches[2]
    $DB_HOST = $matches[3]
    $DB_NAME = $matches[4]
    
    Write-Host "🔌 Connexion à: $DB_HOST/$DB_NAME" -ForegroundColor Yellow
    
    # Vérifier si psql est disponible
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlPath) {
        Write-Host "❌ Erreur: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
        Write-Host "💡 Installez PostgreSQL client tools ou utilisez Docker:" -ForegroundColor Yellow
        Write-Host "   docker run -i --rm postgres psql $DATABASE_URL < $MIGRATION_FILE" -ForegroundColor Cyan
        exit 1
    }
    
    # Appliquer la migration
    Write-Host "⏳ Application de la migration..." -ForegroundColor Yellow
    
    $env:PGPASSWORD = $DB_PASS
    $result = & psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $MIGRATION_FILE 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        
        # Vérifier que la vue matérialisée existe
        Write-Host "🔍 Vérification de la vue matérialisée..." -ForegroundColor Yellow
        $checkResult = & psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized');" 2>&1
        
        if ($checkResult -match "t") {
            Write-Host "✅ Vue matérialisée 'services_search_optimized' créée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Vue matérialisée non trouvée. Vérifiez les logs ci-dessus." -ForegroundColor Yellow
        }
        
        # Rafraîchir la vue initiale
        Write-Host "🔄 Rafraîchissement initial de la vue matérialisée..." -ForegroundColor Yellow
        & psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT refresh_services_search_optimized();" 2>&1 | Out-Null
        
        Write-Host "✅ Vue matérialisée rafraîchie!" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
    
} else {
    Write-Host "❌ Erreur: Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Migration terminée avec succès!" -ForegroundColor Green
Write-Host "📊 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Initialiser SearchCacheService dans AppState" -ForegroundColor White
Write-Host "   2. Configurer le refresh automatique (cron)" -ForegroundColor White
Write-Host "   3. Tester les performances" -ForegroundColor White

