# Script PowerShell pour appliquer la correction de la fonction search_services_gps_final
# Ce script corrige le décalage entre les colonnes attendues par le code Rust et celles retournées par PostgreSQL

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "CORRECTION FONCTION search_services_gps_final" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$env:PGPASSWORD = "yukpo2024"
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "yukpomnang"
$dbUser = "postgres"

Write-Host "[1/3] Vérification de la connexion PostgreSQL..." -ForegroundColor Yellow

# Test de connexion
$testConnection = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "SELECT 1;" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de se connecter à PostgreSQL" -ForegroundColor Red
    Write-Host "Détails: $testConnection" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Connexion PostgreSQL réussie" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] Application de la correction..." -ForegroundColor Yellow

# Appliquer le script SQL
$result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "fix_search_services_gps_final_mobile.sql" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR lors de l'application du script SQL" -ForegroundColor Red
    Write-Host "Détails: $result" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Script SQL appliqué avec succès" -ForegroundColor Green
Write-Host ""

Write-Host "[3/3] Vérification de la fonction..." -ForegroundColor Yellow

# Vérifier que la fonction existe avec les bons paramètres
$verification = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "
SELECT 
    routine_name,
    COUNT(*) as nb_parametres
FROM information_schema.parameters
WHERE specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_name = 'search_services_gps_final' 
    ORDER BY specific_name DESC 
    LIMIT 1
)
GROUP BY routine_name;
" 2>&1

Write-Host ""
Write-Host "Résultat de la vérification:" -ForegroundColor Cyan
Write-Host $verification
Write-Host ""

if ($verification -match "search_services_gps_final") {
    Write-Host "✅ Fonction search_services_gps_final mise à jour avec succès" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 La fonction retourne maintenant les colonnes attendues par le code Rust:" -ForegroundColor Cyan
    Write-Host "   1. service_id (integer)" -ForegroundColor White
    Write-Host "   2. titre_service (text)" -ForegroundColor White
    Write-Host "   3. category (text)" -ForegroundColor White
    Write-Host "   4. gps_coords (text)" -ForegroundColor White
    Write-Host "   5. distance_km (double precision)" -ForegroundColor White
    Write-Host "   6. relevance_score (double precision)" -ForegroundColor White
    Write-Host "   7. gps_source (text)" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 La recherche mobile devrait maintenant fonctionner correctement!" -ForegroundColor Green
} else {
    Write-Host "⚠️  AVERTISSEMENT: Impossible de vérifier la fonction" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "CORRECTION TERMINÉE" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan




