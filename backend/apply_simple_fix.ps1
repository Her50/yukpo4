# Script simple pour appliquer les corrections de recherche d'images
Write-Host "=== APPLICATION DES CORRECTIONS DE RECHERCHE D'IMAGES ===" -ForegroundColor Cyan

# Vérifier que le fichier SQL existe
if (-not (Test-Path "simple_fix.sql")) {
    Write-Host "Erreur: Le fichier simple_fix.sql n'est pas trouvé!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Fichier simple_fix.sql trouvé" -ForegroundColor Green

# Instructions pour l'utilisateur
Write-Host "`nPour corriger la recherche d'images, vous devez exécuter le script SQL dans votre base de données yukpo_db." -ForegroundColor Yellow

Write-Host "`nMÉTHODES DISPONIBLES:" -ForegroundColor Cyan
Write-Host "1. pgAdmin (interface graphique)" -ForegroundColor White
Write-Host "2. psql (ligne de commande)" -ForegroundColor White
Write-Host "3. DBeaver ou autre client SQL" -ForegroundColor White

Write-Host "`nCOMMANDE PSQL (si disponible):" -ForegroundColor Yellow
Write-Host "psql -h localhost -U postgres -d yukpo_db -f simple_fix.sql" -ForegroundColor Gray

Write-Host "`nÉTAPES APRÈS CORRECTION:" -ForegroundColor Cyan
Write-Host "1. Vérifier que les colonnes ont été ajoutées" -ForegroundColor White
Write-Host "2. Tester la fonction search_images_by_metadata" -ForegroundColor White
Write-Host "3. Redémarrer le serveur Rust avec: cargo run --features image_search" -ForegroundColor White

Write-Host "`nVÉRIFICATION:" -ForegroundColor Cyan
Write-Host "Après avoir exécuté le script SQL, vous pouvez vérifier avec:" -ForegroundColor White
Write-Host 'SELECT column_name FROM information_schema.columns WHERE table_name = ''media'' AND column_name LIKE ''image_%'';' -ForegroundColor Gray

Write-Host "`nAppuyez sur une touche pour continuer..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 