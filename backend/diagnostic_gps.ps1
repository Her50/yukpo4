# Script de diagnostic GPS
# Exécutez ce script depuis le répertoire backend

Write-Host "🔍 DIAGNOSTIC GPS - VÉRIFICATION DES DONNÉES" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

Write-Host ""
Write-Host "📋 EXÉCUTION DU DIAGNOSTIC :" -ForegroundColor Yellow
Write-Host ""

Write-Host "1️⃣ Exécuter le diagnostic SQL :" -ForegroundColor Cyan
Write-Host "   psql -h localhost -U postgres -d yukpo_db -f diagnostic_gps.sql"
Write-Host ""

Write-Host "2️⃣ Analyser les résultats :" -ForegroundColor White
Write-Host "   - Vérifier le nombre total de services"
Write-Host "   - Vérifier les services avec coordonnées GPS"
Write-Host "   - Tester les fonctions GPS"
Write-Host "   - Vérifier le calcul de distance"
Write-Host ""

Write-Host "3️⃣ Problèmes possibles identifiés :" -ForegroundColor Red
Write-Host "   - Aucun service avec coordonnées GPS"
Write-Host "   - Coordonnées GPS mal formatées"
Write-Host "   - Fonctions GPS qui ne fonctionnent pas"
Write-Host "   - Filtrage GPS trop strict"
Write-Host ""

Write-Host "🚀 PRÊT À DIAGNOSTIQUER ?" -ForegroundColor Green
Write-Host "Exécutez : psql -h localhost -U postgres -d yukpo_db -f diagnostic_gps.sql" -ForegroundColor Yellow 