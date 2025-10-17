@echo off
echo.
echo ========================================
echo   MONITORING AUTOMATIQUE YUKPOMNANG
echo ========================================
echo.
echo Lancement du monitoring automatique...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start-with-monitoring.ps1"
pause

