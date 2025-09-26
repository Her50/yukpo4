@echo off
echo ========================================
echo Tests Mobile Yukpo
echo ========================================
echo.

echo [%date% %time%] Demarrage des tests...
echo.

echo [%date% %time%] Test 1: Tests d'authentification
node scripts/test-auth-mobile.js
if %errorlevel% neq 0 (
    echo [%date% %time%] ERREUR: Tests d'authentification echoues
    goto :error
)
echo [%date% %time%] SUCCESS: Tests d'authentification reussis
echo.

echo [%date% %time%] Test 2: Tests de fonctionnalites
node scripts/test-mobile-features.js
if %errorlevel% neq 0 (
    echo [%date% %time%] ERREUR: Tests de fonctionnalites echoues
    goto :error
)
echo [%date% %time%] SUCCESS: Tests de fonctionnalites reussis
echo.

echo ========================================
echo [%date% %time%] TOUS LES TESTS SONT PASSES !
echo L'application mobile Yukpo est prete pour les tests utilisateur.
echo ========================================
echo.
echo Prochaines etapes:
echo 1. Installer l'APK sur un appareil Android
echo 2. Tester l'inscription et la connexion
echo 3. Verifier la navigation dans l'application
echo 4. Tester les fonctionnalites principales
echo.
echo Lien d'installation: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds/14729f6c-9ae9-48bd-96e2-4225145bdbf8
echo.
goto :end

:error
echo ========================================
echo [%date% %time%] CERTAINS TESTS ONT ECHOUE
echo Verifiez les logs pour plus de details.
echo ========================================
exit /b 1

:end
exit /b 0

