@echo off
echo ========================================
echo    DEMARRAGE YUKPOMNANG MOBILE
echo ========================================
echo.
echo Le serveur va demarrer...
echo Un QR code va apparaitre dans quelques secondes.
echo.
echo Sur votre telephone:
echo   1. Ouvrez Expo Go
echo   2. Scannez le QR code
echo.
echo Pour arreter: appuyez sur Q puis Entree
echo.
echo ========================================
echo.

cd /d "%~dp0"
npx expo start

