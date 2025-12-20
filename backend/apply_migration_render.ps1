# Script PowerShell pour appliquer la migration de performance sur Render
# Date: 2025-11-28

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application de la migration de performance sur Render" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Informations de connexion
$hostname = "your-render-db-host.render.com"
$database = "yukpo_db"
$username = "yukpo_db_user"
$password = "YOUR_PASSWORD"
$connectionString = "postgresql://${username}:${password}@${hostname}/${database}"

# Chemin de la migration (depuis le répertoire backend)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationFile = Join-Path $scriptDir "migrations\20251128_001_optimize_search_performance_indexes.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lecture de la migration: $migrationFile" -ForegroundColor Cyan
$migrationContent = Get-Content $migrationFile -Raw

Write-Host "🔌 Connexion à la base de données Render..." -ForegroundColor Cyan
Write-Host "   Host: $hostname" -ForegroundColor Gray
Write-Host "   Database: $database" -ForegroundColor Gray
Write-Host "   User: $username" -ForegroundColor Gray

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL pour obtenir psql" -ForegroundColor Yellow
    Write-Host "   Ou utilisez la méthode via Render Dashboard (voir APPLICATION_MIGRATIONS.md)" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ psql trouvé: $($psqlPath.Source)" -ForegroundColor Green

# Appliquer la migration
Write-Host "`n📊 Application de la migration..." -ForegroundColor Cyan
Write-Host "   Cela peut prendre quelques minutes selon la taille de la base..." -ForegroundColor Yellow

try {
    # Exécuter la migration
    $env:PGPASSWORD = $password
    $result = $migrationContent | & psql -h $hostname -U $username -d $database -f - 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host "`n📊 Vérification des index créés..." -ForegroundColor Cyan
        
        # Vérifier les index
        $checkQuery = @"
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('publicites', 'autocomplete_characteristics', 'services')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
"@
        
        $checkResult = $checkQuery | & psql -h $hostname -U $username -d $database -t 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $checkResult -ForegroundColor Gray
            Write-Host "`n✅ Index vérifiés avec succès!" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️ Impossible de vérifier les index (mais la migration a réussi)" -ForegroundColor Yellow
        }
        
        # Vérifier l'extension pg_trgm
        Write-Host "`n🔍 Vérification de l'extension pg_trgm..." -ForegroundColor Cyan
        $extQuery = "SELECT * FROM pg_extension WHERE extname = 'pg_trgm';"
        $extResult = $extQuery | & psql -h $hostname -U $username -d $database -t 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $extResult) {
            Write-Host "✅ Extension pg_trgm installée" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️ Extension pg_trgm non trouvée (peut être déjà installée)" -ForegroundColor Yellow
        }
        
    }
    else {
        Write-Host "`n❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
    
}
catch {
    Write-Host "`n❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
finally {
    # Nettoyer le mot de passe de l'environnement
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`n🎉 Migration terminée avec succès!" -ForegroundColor Green
Write-Host "`n📈 Impact attendu:" -ForegroundColor Cyan
Write-Host "   - Temps de recherche: ~10s → <2s (80% d'amélioration)" -ForegroundColor Gray
Write-Host "   - Requête publicités: ~1.1s → <100ms (90% d'amélioration)" -ForegroundColor Gray
Write-Host "   - Jointures: Significativement plus rapides" -ForegroundColor Gray

