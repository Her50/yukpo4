@echo off
echo ========================================
echo Test des corrections de detection d'intention
echo ========================================

echo.
echo 1. Compilation du backend...
cargo build

if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Compilation echouee
    pause
    exit /b 1
)

echo.
echo 2. Lancement du backend en arriere-plan...
start /B cargo run

echo.
echo 3. Attente du demarrage du backend (10 secondes)...
timeout /t 10 /nobreak > nul

echo.
echo 4. Test de detection d'intention...
python test_intention_detection.py

echo.
echo 5. Arret du backend...
taskkill /F /IM yukpomnang_backend.exe 2>nul
taskkill /F /IM cargo.exe 2>nul

echo.
echo ========================================
echo Tests termines
echo ========================================
pause 