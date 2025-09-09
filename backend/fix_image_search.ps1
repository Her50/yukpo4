# Script pour corriger la recherche d'images
# Ce script applique les corrections nécessaires à la base de données

Write-Host "=== CORRECTION DE LA RECHERCHE D'IMAGES ===" -ForegroundColor Cyan
Write-Host "Base de données: yukpo_db" -ForegroundColor Yellow

# Vérifier si nous sommes dans le bon répertoire
if (-not (Test-Path "fix_media_table.sql")) {
    Write-Host "Erreur: Le fichier fix_media_table.sql n'est pas trouvé dans le répertoire courant." -ForegroundColor Red
    Write-Host "Assurez-vous d'être dans le répertoire backend." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n1. Vérification des fichiers..." -ForegroundColor Green
Write-Host "✓ fix_media_table.sql trouvé" -ForegroundColor Green
Write-Host "✓ test_image_search.sql trouvé" -ForegroundColor Green

Write-Host "`n2. Instructions pour appliquer les corrections:" -ForegroundColor Yellow
Write-Host "Pour corriger la recherche d'images, vous devez exécuter le script SQL dans votre base de données." -ForegroundColor White

Write-Host "`nOptions disponibles:" -ForegroundColor Cyan
Write-Host "A) Utiliser le script PowerShell interactif (run_sql_fix.ps1)" -ForegroundColor White
Write-Host "B) Exécuter manuellement le script SQL" -ForegroundColor White
Write-Host "C) Utiliser un autre outil de base de données" -ForegroundColor White

Write-Host "`n3. Contenu du script SQL:" -ForegroundColor Yellow
Write-Host "Le script fix_media_table.sql va:" -ForegroundColor White
Write-Host "  - Ajouter les colonnes image_signature, image_hash, image_metadata à la table media" -ForegroundColor White
Write-Host "  - Créer les index nécessaires" -ForegroundColor White
Write-Host "  - Créer les fonctions PostgreSQL pour la recherche d'images" -ForegroundColor White

Write-Host "`n4. Test après correction:" -ForegroundColor Yellow
Write-Host "Après avoir appliqué les corrections, utilisez test_image_search.sql pour vérifier que tout fonctionne." -ForegroundColor White

Write-Host "`n5. Redémarrage du serveur:" -ForegroundColor Yellow
Write-Host "Après les corrections, redémarrez votre serveur Rust avec:" -ForegroundColor White
Write-Host "  cargo run --features image_search" -ForegroundColor Cyan

Write-Host "`n=== RÉSUMÉ DES ACTIONS REQUISES ===" -ForegroundColor Cyan
Write-Host "1. Exécuter fix_media_table.sql dans la base de données yukpo_db" -ForegroundColor White
Write-Host "2. Tester avec test_image_search.sql" -ForegroundColor White
Write-Host "3. Redémarrer le serveur avec la feature image_search" -ForegroundColor White

Write-Host "`nVoulez-vous exécuter le script PowerShell interactif maintenant ? (o/n)" -ForegroundColor Yellow
$choice = Read-Host

if ($choice -eq "o" -or $choice -eq "O") {
    Write-Host "`nExécution du script interactif..." -ForegroundColor Green
    & ".\run_sql_fix.ps1"
} else {
    Write-Host "`nVous pouvez exécuter manuellement les scripts SQL dans votre base de données." -ForegroundColor Cyan
    Write-Host "N'oubliez pas de redémarrer le serveur après les corrections !" -ForegroundColor Yellow
} 