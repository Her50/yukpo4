# Script de test pour vérifier le filtrage GPS
# Exécutez ce script depuis le répertoire backend

Write-Host "🧪 TEST DU FILTRAGE GPS" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green

Write-Host ""
Write-Host "📋 ÉTAPES DE TEST :" -ForegroundColor Yellow
Write-Host ""

Write-Host "1️⃣ Vérifier que le backend est lancé :" -ForegroundColor Cyan
Write-Host "   - Le backend doit être en cours d'exécution sur http://127.0.0.1:3001"
Write-Host ""

Write-Host "2️⃣ Tester la recherche avec GPS :" -ForegroundColor Cyan
Write-Host "   - Dans le frontend, sélectionner une zone GPS au Cameroun"
Write-Host "   - Faire une recherche (ex: 'restaurant')"
Write-Host "   - Vérifier que seuls les services du Cameroun s'affichent"
Write-Host ""

Write-Host "3️⃣ Vérifier les logs du backend :" -ForegroundColor Cyan
Write-Host "   - Plus d'erreur 'extract_gps_coordinates n'existe pas'"
Write-Host "   - Logs de filtrage GPS visibles"
Write-Host ""

Write-Host "4️⃣ Vérifier la performance :" -ForegroundColor Cyan
Write-Host "   - La recherche doit être plus rapide (filtrage GPS actif)"
Write-Host "   - Plus de fallback SQL lent"
Write-Host ""

Write-Host "🔍 RÉSULTATS ATTENDUS :" -ForegroundColor Green
Write-Host "   ✅ Plus d'erreur PostgreSQL sur les fonctions GPS"
Write-Host "   ✅ Filtrage automatique par zone GPS"
Write-Host "   ✅ Seuls les services dans la zone s'affichent"
Write-Host "   ✅ Recherche plus rapide et pertinente"
Write-Host ""

Write-Host "⚠️  EN CAS DE PROBLÈME :" -ForegroundColor Red
Write-Host "   - Vérifier que le backend est bien redémarré"
Write-Host "   - Vérifier que les fonctions PostgreSQL sont créées"
Write-Host "   - Consulter les logs du backend pour les erreurs"
Write-Host ""

Write-Host "🚀 Prêt à tester ? Lancez une recherche avec GPS dans le frontend !" -ForegroundColor Green 