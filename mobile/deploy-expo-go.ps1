# Script pour déployer l'application dans Expo Go
Write-Host "Déploiement de l'application Yukpomnang dans Expo Go..." -ForegroundColor Cyan

Write-Host "`n1. Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier que npm est installé
try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm installé: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ npm non installé" -ForegroundColor Red
    exit 1
}

# Vérifier que Expo CLI est installé
try {
    $expoVersion = npx expo --version
    Write-Host "   ✅ Expo CLI disponible: $expoVersion" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Expo CLI non disponible" -ForegroundColor Red
    Write-Host "   Installation: npm install -g @expo/cli" -ForegroundColor Yellow
}

Write-Host "`n2. Instructions pour Expo Go:" -ForegroundColor Cyan

Write-Host "   📱 Sur votre téléphone:" -ForegroundColor White
Write-Host "   1. Téléchargez l'app 'Expo Go' depuis:" -ForegroundColor White
Write-Host "      - App Store (iOS): https://apps.apple.com/app/expo-go/id982107779" -ForegroundColor Gray
Write-Host "      - Google Play (Android): https://play.google.com/store/apps/details?id=host.exp.exponent" -ForegroundColor Gray

Write-Host "`n   💻 Sur votre ordinateur:" -ForegroundColor White
Write-Host "   1. Lancez l'application:" -ForegroundColor White
Write-Host "      npm start" -ForegroundColor Gray
Write-Host "   2. Un QR code apparaîtra dans le terminal" -ForegroundColor White
Write-Host "   3. Scannez le QR code avec Expo Go" -ForegroundColor White

Write-Host "`n3. Commandes alternatives:" -ForegroundColor Cyan
Write-Host "   - Démarrer en mode tunnel (si même réseau ne fonctionne pas):" -ForegroundColor White
Write-Host "     npx expo start --tunnel" -ForegroundColor Gray
Write-Host "   - Démarrer en mode local:" -ForegroundColor White
Write-Host "     npx expo start --localhost" -ForegroundColor Gray
Write-Host "   - Ouvrir dans le navigateur:" -ForegroundColor White
Write-Host "     npx expo start --web" -ForegroundColor Gray

Write-Host "`n4. URL de développement:" -ForegroundColor Cyan
Write-Host "   Une fois lancé, vous verrez quelque chose comme:" -ForegroundColor White
Write-Host "   exp://192.168.1.100:8081" -ForegroundColor Gray
Write-Host "   Cette URL peut être partagée pour tester l'app" -ForegroundColor White

Write-Host "`n5. Dépannage:" -ForegroundColor Cyan
Write-Host "   - Même réseau WiFi requis (téléphone et ordinateur)" -ForegroundColor White
Write-Host "   - Firewall peut bloquer la connexion" -ForegroundColor White
Write-Host "   - Utilisez --tunnel si problème de réseau" -ForegroundColor White
Write-Host "   - Redémarrez l'app si elle ne se charge pas" -ForegroundColor White

Write-Host "`n6. Test de l'application:" -ForegroundColor Cyan
Write-Host "   Une fois dans Expo Go, testez:" -ForegroundColor White
Write-Host "   - Connexion avec: test@example.com / test123" -ForegroundColor Gray
Write-Host "   - Création de compte" -ForegroundColor Gray
Write-Host "   - Navigation entre les écrans" -ForegroundColor Gray
Write-Host "   - Fonctionnalites de l application" -ForegroundColor Gray

Write-Host "`n🚀 Prêt à lancer! Exécutez: npm start" -ForegroundColor Green
