@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title Yukpomnang Mobile - EAS Build

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🚀 YUKPOMNANG MOBILE - EAS BUILD HELPER          ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Vérifier qu'on est dans le bon dossier
if not exist "package.json" (
    echo ❌ Erreur : package.json non trouvé
    echo    Exécutez ce script depuis le dossier mobile/
    pause
    exit /b 1
)

:MENU
echo.
echo ════════════════════════════════════════════════════════════
echo  MENU PRINCIPAL
echo ════════════════════════════════════════════════════════════
echo.
echo  1. 🔍 Vérifier la configuration
echo  2. 🔐 Se connecter à Expo (eas login)
echo  3. 📦 Installer les dépendances (npm install)
echo  4. 🚀 Lancer le Build EAS Preview
echo  5. 📋 Voir mes builds
echo  6. 🧹 Nettoyer et réinstaller
echo  7. 🛠️  Réparer le fonctionnement local
echo  8. 🧪 Publier en mode tests (Play link + TestFlight link)
echo  9. 📚 Ouvrir la documentation
echo  10. ❌ Quitter
echo.
echo ════════════════════════════════════════════════════════════
echo.

set /p choice="Votre choix (1-10) : "

if "%choice%"=="1" goto VERIFY
if "%choice%"=="2" goto LOGIN
if "%choice%"=="3" goto INSTALL
if "%choice%"=="4" goto BUILD
if "%choice%"=="5" goto LIST
if "%choice%"=="6" goto CLEAN
if "%choice%"=="7" goto REPAIR
if "%choice%"=="8" goto PUBLISH_TESTS
if "%choice%"=="9" goto DOCS
if "%choice%"=="10" goto EXIT

echo ❌ Choix invalide
timeout /t 2 >nul
goto MENU

:VERIFY
echo.
echo 🔍 Vérification de la configuration...
echo ════════════════════════════════════════════════════════════
echo.
powershell -ExecutionPolicy Bypass -File "./verif-eas.ps1"
echo.
pause
goto MENU

:LOGIN
echo.
echo 🔐 Connexion à Expo...
echo ════════════════════════════════════════════════════════════
echo.
echo ℹ️  Utilisez le compte : hernandezlele
echo.
call eas login
echo.
if %errorlevel% equ 0 (
    echo ✅ Connexion réussie !
) else (
    echo ❌ Erreur de connexion
)
pause
goto MENU

:INSTALL
echo.
echo 📦 Installation des dépendances...
echo ════════════════════════════════════════════════════════════
echo.
call npm install
echo.
if %errorlevel% equ 0 (
    echo ✅ Installation réussie !
) else (
    echo ❌ Erreur lors de l'installation
)
pause
goto MENU

:BUILD
echo.
echo 🚀 Lancement du Build EAS Preview...
echo ════════════════════════════════════════════════════════════
echo.
echo ⏱️  Le build prendra environ 15-25 minutes
echo 🔗 Vous recevrez un lien pour suivre la progression
echo 📱 L'APK sera téléchargeable une fois terminé
echo.
echo Appuyez sur une touche pour continuer ou Ctrl+C pour annuler...
pause >nul
echo.
call npx eas build --platform android --profile preview
echo.
if %errorlevel% equ 0 (
    echo.
    echo ✅ Build lancé avec succès !
    echo 📊 Suivez la progression sur le lien fourni
) else (
    echo.
    echo ❌ Erreur lors du lancement du build
    echo 💡 Vérifiez votre connexion et votre configuration
)
pause
goto MENU

:LIST
echo.
echo 📋 Liste de vos builds...
echo ════════════════════════════════════════════════════════════
echo.
call eas build:list
echo.
pause
goto MENU

:CLEAN
echo.
echo 🧹 Nettoyage complet...
echo ════════════════════════════════════════════════════════════
echo.
echo ⚠️  Cela va supprimer :
echo    - node_modules
echo    - .expo
echo    - package-lock.json
echo.
set /p confirm="Continuer ? (O/N) : "
if /i not "%confirm%"=="O" goto MENU

echo.
echo 🗑️  Suppression des fichiers...
if exist "node_modules" rmdir /s /q node_modules
if exist ".expo" rmdir /s /q .expo
if exist "package-lock.json" del /q package-lock.json
echo ✅ Nettoyage terminé !

echo.
echo 📦 Réinstallation des dépendances...
call npm install
echo.
if %errorlevel% equ 0 (
    echo ✅ Réinstallation réussie !
) else (
    echo ❌ Erreur lors de la réinstallation
)
pause
goto MENU

:REPAIR
echo.
echo 🛠️  Réparation du fonctionnement local...
echo ════════════════════════════════════════════════════════════
echo.
echo Choisissez une option :
echo.
echo  1. Nettoyage léger (cache uniquement)
echo  2. Nettoyage complet (node_modules + cache)
echo  3. Retour au menu
echo.
set /p repair_choice="Votre choix (1-3) : "

if "%repair_choice%"=="1" (
    echo.
    echo 🗑️  Nettoyage du cache...
    if exist ".expo" rmdir /s /q .expo
    call npx expo start --clear
    echo ✅ Cache nettoyé ! Essayez de relancer l'app.
) else if "%repair_choice%"=="2" (
    echo.
    echo 🗑️  Nettoyage complet...
    if exist "node_modules" rmdir /s /q node_modules
    if exist ".expo" rmdir /s /q .expo
    if exist "android" rmdir /s /q android
    if exist "ios" rmdir /s /q ios
    if exist "package-lock.json" del /q package-lock.json
    echo.
    echo 📦 Réinstallation...
    call npm install
    echo.
    echo ✅ Réparation terminée ! Essayez de relancer l'app avec: npm start
) else if "%repair_choice%"=="3" (
    goto MENU
) else (
    echo ❌ Choix invalide
    timeout /t 2 >nul
    goto REPAIR
)
pause
goto MENU

:DOCS
echo.
echo 📚 Documentation disponible...
echo ════════════════════════════════════════════════════════════
echo.
echo  📄 DEMARRAGE_EAS_BUILD.md       - Guide de démarrage rapide
echo  📄 GUIDE_EAS_BUILD.md           - Guide complet
echo  📄 VERIFICATION_AVANT_BUILD.md  - Checklist détaillée
echo  📄 RESUME_CONFIGURATION_EAS.md  - Résumé de la config
echo.
echo  🔗 Documentation en ligne :
echo     https://docs.expo.dev/build/introduction/
echo.
set /p open_doc="Ouvrir le guide de démarrage ? (O/N) : "
if /i "%open_doc%"=="O" (
    start "" "DEMARRAGE_EAS_BUILD.md"
)
pause
goto MENU

:EXIT
echo.
echo 👋 Au revoir !
echo.
timeout /t 2 >nul
exit /b 0

:PUBLISH_TESTS
echo.
echo 🧪 Publication en mode tests (Play link + TestFlight link)...
echo ════════════════════════════════════════════════════════════
echo.
echo ℹ️  Ce script lance:
echo    - Android: build AAB + submit (Play Console - testing)
echo    - iOS: build + submit (TestFlight)
echo.
echo ⚠️  Vous devrez être connecté à Expo (eas login).
echo.
echo Appuyez sur une touche pour continuer ou Ctrl+C pour annuler...
pause >nul
echo.
powershell -ExecutionPolicy Bypass -File ".\publish-testing-links.ps1"
echo.
pause
goto MENU

