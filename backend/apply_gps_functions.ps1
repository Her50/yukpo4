# Script pour appliquer les fonctions GPS manquantes
# Résout le problème "aucun résultat après sélection de zone GPS"

Write-Host "🚀 APPLICATION DES FONCTIONS GPS MANQUANTES" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 DIAGNOSTIC :" -ForegroundColor Yellow
Write-Host "   - Recherche GPS retourne 0 résultats" -ForegroundColor Red
Write-Host "   - Fonctions PostgreSQL GPS manquantes" -ForegroundColor Red
Write-Host "   - Code Rust essaie d'appeler extract_gps_coordinates()" -ForegroundColor Red
Write-Host ""

Write-Host "📋 ÉTAPES DE RÉSOLUTION :" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣ Vérifier la connexion PostgreSQL :" -ForegroundColor Yellow
Write-Host "   Test de connexion à la base yukpo_db..." -ForegroundColor White

# Test de connexion PostgreSQL
try {
    $testConnection = & psql -h localhost -U postgres -d yukpo_db -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Connexion PostgreSQL OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur connexion PostgreSQL" -ForegroundColor Red
        Write-Host "   Vérifiez que PostgreSQL est démarré et accessible" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur connexion PostgreSQL" -ForegroundColor Red
    Write-Host "   Vérifiez que PostgreSQL est démarré et accessible" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2️⃣ Vérifier les fonctions GPS existantes :" -ForegroundColor Yellow
Write-Host "   Recherche des fonctions GPS dans la base..." -ForegroundColor White

# Vérifier les fonctions GPS existantes
$gpsFunctions = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname LIKE '%gps%';" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   📋 Fonctions GPS trouvées :" -ForegroundColor Cyan
    $gpsFunctions | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
} else {
    Write-Host "   ❌ Erreur lors de la vérification des fonctions GPS" -ForegroundColor Red
}

Write-Host ""
Write-Host "3️⃣ Créer les fonctions GPS manquantes :" -ForegroundColor Yellow
Write-Host "   Application du script SQL..." -ForegroundColor White

# Appliquer le script SQL
try {
    $result = & psql -h localhost -U postgres -d yukpo_db -f "create_gps_enhanced_search_function.sql" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Fonctions GPS créées avec succès" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur lors de la création des fonctions GPS" -ForegroundColor Red
        Write-Host "   Détails de l'erreur :" -ForegroundColor Red
        $result | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
    }
} catch {
    Write-Host "   ❌ Erreur lors de la création des fonctions GPS" -ForegroundColor Red
}

Write-Host ""
Write-Host "4️⃣ Vérifier que les fonctions sont créées :" -ForegroundColor Yellow
Write-Host "   Vérification finale..." -ForegroundColor White

# Vérification finale
$finalCheck = & psql -h localhost -U postgres -d yukpo_db -c "SELECT proname FROM pg_proc WHERE proname IN ('calculate_gps_distance_km', 'extract_gps_coordinates', 'search_images_by_metadata_with_gps', 'search_services_in_gps_zone');" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Toutes les fonctions GPS sont créées" -ForegroundColor Green
    $finalCheck | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
} else {
    Write-Host "   ❌ Certaines fonctions GPS sont manquantes" -ForegroundColor Red
}

Write-Host ""
Write-Host "5️⃣ Tester le filtrage GPS :" -ForegroundColor Yellow
Write-Host "   Test de la fonction de recherche GPS..." -ForegroundColor White

# Test de la fonction GPS
try {
    $testResult = & psql -h localhost -U postgres -d yukpo_db -c "SELECT search_services_in_gps_zone('4.0511,9.7679', 25, NULL, 5);" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Test de recherche GPS réussi" -ForegroundColor Green
        Write-Host "   Résultat :" -ForegroundColor White
        $testResult | ForEach-Object { Write-Host "      $_" -ForegroundColor White }
    } else {
        Write-Host "   ❌ Erreur lors du test de recherche GPS" -ForegroundColor Red
        Write-Host "   Détails :" -ForegroundColor Red
        $testResult | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
    }
} catch {
    Write-Host "   ❌ Erreur lors du test de recherche GPS" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 RÉSULTAT ATTENDU :" -ForegroundColor Green
Write-Host "   - Fonctions GPS créées dans PostgreSQL" -ForegroundColor White
Write-Host "   - Recherche GPS fonctionnelle" -ForegroundColor White
Write-Host "   - Plus de 0 résultats après sélection de zone GPS" -ForegroundColor White
Write-Host ""

Write-Host "🚀 PROCHAINES ÉTAPES :" -ForegroundColor Cyan
Write-Host "   1. Redémarrer le backend Rust" -ForegroundColor White
Write-Host "   2. Tester la recherche avec zone GPS sélectionnée" -ForegroundColor White
Write-Host "   3. Vérifier que les résultats s'affichent correctement" -ForegroundColor White
Write-Host ""

Write-Host "✅ Script terminé !" -ForegroundColor Green 