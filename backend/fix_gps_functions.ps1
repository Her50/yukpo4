# Script pour corriger les fonctions GPS manquantes
# Resout le probleme "aucun resultat apres selection de zone GPS"

Write-Host "CORRECTION DES FONCTIONS GPS MANQUANTES" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""

Write-Host "PROBLEME IDENTIFIE :" -ForegroundColor Yellow
Write-Host "   - Recherche GPS retourne 0 resultats" -ForegroundColor Red
Write-Host "   - Fonctions PostgreSQL GPS manquantes" -ForegroundColor Red
Write-Host "   - Code Rust essaie d'appeler extract_gps_coordinates()" -ForegroundColor Red
Write-Host ""

Write-Host "ETAPES DE RESOLUTION :" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Test de connexion PostgreSQL..." -ForegroundColor Yellow

# Test de connexion PostgreSQL
try {
    $testConnection = & psql -h localhost -U postgres -d yukpo_db -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK - Connexion PostgreSQL reussie" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR - Connexion PostgreSQL echouee" -ForegroundColor Red
        Write-Host "   Verifiez que PostgreSQL est demarre et accessible" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ERREUR - Connexion PostgreSQL echouee" -ForegroundColor Red
    Write-Host "   Verifiez que PostgreSQL est demarre et accessible" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Verification des fonctions GPS existantes..." -ForegroundColor Yellow

# Verifier les fonctions GPS existantes
$gpsFunctions = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname LIKE '%gps%';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   Fonctions GPS trouvees :" -ForegroundColor Cyan
    $gpsFunctions | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
} else {
    Write-Host "   ERREUR lors de la verification des fonctions GPS" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Creation des fonctions GPS manquantes..." -ForegroundColor Yellow

# Appliquer le script SQL
try {
    $result = & psql -h localhost -U postgres -d yukpo_db -f "create_gps_enhanced_search_function.sql" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK - Fonctions GPS creees avec succes" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR lors de la creation des fonctions GPS" -ForegroundColor Red
        Write-Host "   Details de l'erreur :" -ForegroundColor Red
        $result | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
    }
} catch {
    Write-Host "   ERREUR lors de la creation des fonctions GPS" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Verification finale des fonctions GPS..." -ForegroundColor Yellow

# Verification finale
$finalCheck = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname IN ('calculate_gps_distance_km', 'extract_gps_coordinates', 'search_images_by_metadata_with_gps', 'search_services_in_gps_zone');" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK - Toutes les fonctions GPS sont creees" -ForegroundColor Green
    $finalCheck | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
} else {
    Write-Host "   ERREUR - Certaines fonctions GPS sont manquantes" -ForegroundColor Red
}

Write-Host ""
Write-Host "5. Test du filtrage GPS..." -ForegroundColor Yellow

# Test de la fonction GPS
try {
    $testResult = & psql -h localhost -U postgres -d yukpo_db -c "SELECT search_services_in_gps_zone('4.0511,9.7679', 25, NULL, 5);" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK - Test de recherche GPS reussi" -ForegroundColor Green
        Write-Host "   Resultat :" -ForegroundColor White
        $testResult | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
    } else {
        Write-Host "   ERREUR lors du test de recherche GPS" -ForegroundColor Red
        Write-Host "   Details :" -ForegroundColor Red
        $testResult | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
    }
} catch {
    Write-Host "   ERREUR lors du test de recherche GPS" -ForegroundColor Red
}

Write-Host ""
Write-Host "RESULTAT ATTENDU :" -ForegroundColor Green
Write-Host "   - Fonctions GPS creees dans PostgreSQL" -ForegroundColor White
Write-Host "   - Recherche GPS fonctionnelle" -ForegroundColor White
Write-Host "   - Plus de 0 resultats apres selection de zone GPS" -ForegroundColor White
Write-Host ""

Write-Host "PROCHAINES ETAPES :" -ForegroundColor Cyan
Write-Host "   1. Redemarrer le backend Rust" -ForegroundColor White
Write-Host "   2. Tester la recherche avec zone GPS selectionnee" -ForegroundColor White
Write-Host "   3. Verifier que les resultats s'affichent correctement" -ForegroundColor White
Write-Host ""

Write-Host "Script termine !" -ForegroundColor Green 