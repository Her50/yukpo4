@echo off
chcp 65001 >nul
cls
echo.
echo ====================================
echo   YUKPOMNANG MOBILE - LANCEMENT
echo ====================================
echo.

echo [1/2] Restauration de App.tsx...
if exist "App.tsx.backup" (
    copy /Y "App.tsx.backup" "App.tsx" >nul 2>&1
    echo   OK - App.tsx restaure
) else (
    echo   INFO - Utilisation du App.tsx actuel
)

echo.
echo [2/2] Lancement de Metro...
echo.
echo ====================================
echo   INSTRUCTIONS
echo ====================================
echo 1. Attendez le QR code
echo 2. Installez Expo Go sur votre telephone
echo 3. Scannez le QR code
echo 4. L'app se chargera automatiquement
echo.
echo Pour arreter: Ctrl+C
echo ====================================
echo.

npm start

