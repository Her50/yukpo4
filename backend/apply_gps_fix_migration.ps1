# Script PowerShell pour appliquer la migration GPS fix sur Render
# =================================================================

Write-Host "🔧 Application de la migration GPS fix..." -ForegroundColor Cyan

# Variables de connexion
$DB_HOST = "your-render-db-host.render.com"
$DB_USER = "yukpo_db_user"
$DB_PASSWORD = "YOUR_PASSWORD"
$DB_NAME = "yukpo_db"

# Chemin du fichier de migration
$MIGRATION_FILE = "migrations\20251130_001_FIX_SEARCH_GPS_FINAL_SIGNATURE.sql"

# Vérifier que le fichier existe
if (-Not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ ERREUR: Le fichier $MIGRATION_FILE n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de migration trouvé: $MIGRATION_FILE" -ForegroundColor Green

# Construire la commande psql
$PGPASSWORD = $DB_PASSWORD
$env:PGPASSWORD = $DB_PASSWORD

$CONNECTION_STRING = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}"

Write-Host ""
Write-Host "📡 Connexion à la base de données Render..." -ForegroundColor Yellow
Write-Host "   Host: $DB_HOST" -ForegroundColor Gray
Write-Host "   Database: $DB_NAME" -ForegroundColor Gray
Write-Host ""

# Exécuter la migration
try {
    $SQL_CONTENT = Get-Content $MIGRATION_FILE -Raw -Encoding UTF8
    
    Write-Host "📝 Exécution de la migration..." -ForegroundColor Yellow
    
    # Utiliser psql si disponible
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        Write-Host "✅ psql trouvé, exécution de la migration..." -ForegroundColor Green
        
        $SQL_CONTENT | psql $CONNECTION_STRING
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ SUCCESS: Migration appliquée avec succès!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🔍 Vérification de la signature..." -ForegroundColor Yellow
            
            # Vérifier la signature
            $VERIFY_SQL = @"
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'search_services_gps_final'
AND n.nspname = 'public';
"@
            
            $VERIFY_SQL | psql $CONNECTION_STRING
            
        } else {
            Write-Host ""
            Write-Host "❌ ERREUR: La migration a échoué (code: $LASTEXITCODE)" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "⚠️ psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Contenu de la migration à exécuter manuellement:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host $SQL_CONTENT -ForegroundColor White
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🌐 Vous pouvez l'exécuter via le dashboard Render ou psql manuellement" -ForegroundColor Yellow
        Write-Host "   URL: https://dashboard.render.com" -ForegroundColor Gray
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Nettoyer la variable d'environnement
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✨ Terminé!" -ForegroundColor Green

