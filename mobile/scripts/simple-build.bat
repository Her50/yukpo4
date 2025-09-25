@echo off
echo 🚀 Build APK Simple pour Yukpomnang

REM Étape 1: Initialiser EAS
echo.
echo 📝 Étape 1: Initialisation du projet EAS
echo Y | npx eas init

REM Étape 2: Configurer EAS
echo.
echo ⚙️ Étape 2: Configuration du projet EAS
echo Y | npx eas build:configure

REM Étape 3: Build APK
echo.
echo 🔨 Étape 3: Génération de l'APK
npx eas build --platform android --profile preview

echo.
echo ✅ Processus terminé!
echo 📱 Vérifiez votre email pour le lien de téléchargement
pause

