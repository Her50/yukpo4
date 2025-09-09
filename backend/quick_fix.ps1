# Script simple pour corriger la recherche d'images
Write-Host "=== CORRECTION DE LA RECHERCHE D'IMAGES ===" -ForegroundColor Cyan
Write-Host "Base de données: yukpo_db" -ForegroundColor Yellow

Write-Host "`nPROBLÈME IDENTIFIÉ:" -ForegroundColor Red
Write-Host "La table media n'a pas les colonnes nécessaires pour la recherche d'images" -ForegroundColor White

Write-Host "`nSOLUTION:" -ForegroundColor Green
Write-Host "Exécuter le script SQL simple_fix.sql dans votre base de données" -ForegroundColor White

Write-Host "`nCOMMANDE PSQL:" -ForegroundColor Yellow
Write-Host "psql -h localhost -U postgres -d yukpo_db -f simple_fix.sql" -ForegroundColor Gray

Write-Host "`nÉTAPES:" -ForegroundColor Cyan
Write-Host "1. Exécuter simple_fix.sql dans yukpo_db" -ForegroundColor White
Write-Host "2. Vérifier avec test_simple.sql" -ForegroundColor White
Write-Host "3. Redémarrer le serveur: cargo run --features image_search" -ForegroundColor White

Write-Host "`nFichiers créés:" -ForegroundColor Green
Write-Host "✓ simple_fix.sql - Script de correction" -ForegroundColor White
Write-Host "✓ test_simple.sql - Script de test" -ForegroundColor White
Write-Host "✓ README_IMAGE_SEARCH_FIX.md - Documentation complète" -ForegroundColor White

Write-Host "`nAppuyez sur une touche pour continuer..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 