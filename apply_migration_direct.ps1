# Script pour appliquer la migration de performance directement
# Usage: .\apply_migration_direct.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application de la migration de performance" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Informations de connexion Render
$hostname = "your-render-db-host.render.com"
$database = "yukpo_db"
$username = "yukpo_db_user"
$password = "YOUR_PASSWORD"

# Chemin de la migration
$migrationFile = "backend\migrations\20251128_001_optimize_search_performance_indexes.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    Write-Host "   Répertoire actuel: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Migration trouvée: $migrationFile" -ForegroundColor Green
Write-Host "`n🔌 Connexion à Render PostgreSQL..." -ForegroundColor Cyan
Write-Host "   Host: $hostname" -ForegroundColor Gray
Write-Host "   Database: $database" -ForegroundColor Gray

# Vérifier psql
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "`n❌ psql n'est pas disponible" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL ou utilisez Render Dashboard" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ psql disponible: $($psql.Source)" -ForegroundColor Green

# Appliquer la migration
Write-Host "`n📊 Application de la migration..." -ForegroundColor Cyan
Write-Host "   ⏱️  Cela peut prendre 2-5 minutes selon la taille de la base..." -ForegroundColor Yellow
Write-Host ""

try {
    $env:PGPASSWORD = $password
    
    # Exécuter la migration
    $output = & psql -h $hostname -U $username -d $database -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Migration appliquée avec succès!" -ForegroundColor Green
        
        # Vérifier les index créés
        Write-Host "`n📊 Vérification des index..." -ForegroundColor Cyan
        
        $checkSql = @"
SELECT 
    tablename,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename IN ('publicites', 'autocomplete_characteristics', 'services')
AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;
"@
        
        $checkResult = $checkSql | & psql -h $hostname -U $username -d $database -t -A 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $checkResult -ForegroundColor Gray
        }
        
        Write-Host "`n🎉 Migration terminée avec succès!" -ForegroundColor Green
        Write-Host "`n📈 Impact attendu:" -ForegroundColor Cyan
        Write-Host "   • Temps de recherche: ~10s → <2s (80% ⬇️)" -ForegroundColor Gray
        Write-Host "   • Requête publicités: ~1.1s → <100ms (90% ⬇️)" -ForegroundColor Gray
        
    } else {
        Write-Host "`n❌ Erreur lors de l'application" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n❌ Erreur: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

