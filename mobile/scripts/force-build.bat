@echo off
echo 🚀 Force Build APK pour Yukpomnang

REM Configurer le token
set EXPO_TOKEN=12jDNlGCXduPK_xGvu6_1D8g9FgoSf3nQRwgzxd_

REM Vérifier la connexion
echo 🔍 Vérification de la connexion...
npx eas whoami

REM Lancer le build Android
echo 🔨 Lancement du build Android...
npx eas build --platform android --profile preview

echo ✅ Build terminé!
echo 📱 Vérifiez votre email pour le lien de téléchargement
pause

