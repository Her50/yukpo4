# Script d'analyse des logs Expo

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Analyse des logs Expo" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Serveur actuel sur port 8081:" -ForegroundColor Yellow
netstat -ano | findstr :8081

Write-Host ""
Write-Host "Test avec app minimale..." -ForegroundColor Yellow

# Vérifier le contenu de l'app actuelle
Write-Host ""
Write-Host "Contenu de App.tsx actuel:" -ForegroundColor Cyan
Get-Content App.tsx

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Instructions de test:" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Ouvrez Expo Go sur votre telephone" -ForegroundColor White
Write-Host "2. Scannez le QR code ou tapez: exp://10.178.110.106:8081" -ForegroundColor White
Write-Host "3. Dites-moi ce qui se passe:" -ForegroundColor White
Write-Host "   - L'app minimale fonctionne-t-elle ?" -ForegroundColor Gray
Write-Host "   - Y a-t-il encore l'erreur 'Something went wrong' ?" -ForegroundColor Gray
Write-Host "   - Y a-t-il des erreurs dans les logs ?" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Si ca marche, on restaure l'app originale" -ForegroundColor White
Write-Host "5. Si ca crash, on identifie le probleme" -ForegroundColor White
Write-Host ""

# Lancer le serveur en mode verbose pour voir tous les logs
Write-Host "Lancement du serveur avec logs detailles..." -ForegroundColor Yellow
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""

npx expo start --clear

