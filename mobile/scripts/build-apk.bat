@echo off
echo 🚀 Démarrage du build automatique APK...

REM Vérifier la connexion EAS
echo 🔍 Vérification de la connexion EAS...
npx eas whoami
if %errorlevel% neq 0 (
    echo ❌ Non connecté à EAS. Veuillez vous connecter avec: npx eas login
    pause
    exit /b 1
)

echo ✅ Connecté à EAS

REM Initialiser le projet EAS
echo 🔧 Initialisation du projet EAS...
echo Y | npx eas init

REM Configurer le projet EAS
echo ⚙️ Configuration du projet EAS...
echo Y | npx eas build:configure

REM Lancer le build APK
echo 🔨 Lancement du build APK...
npx eas build --platform android --profile preview --non-interactive

if %errorlevel% equ 0 (
    echo ✅ Build terminé avec succès!
    echo 📱 Vérifiez votre email ou le dashboard EAS pour télécharger l'APK
    echo 🔗 Dashboard: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds
) else (
    echo ❌ Erreur lors du build
)

pause

