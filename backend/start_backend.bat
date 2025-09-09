@echo off
echo 🚀 Démarrage du backend Yukpo...
echo 📍 Port: 3001
echo 📍 URL: http://127.0.0.1:3001
echo.

cd /d "%~dp0"
cargo run

echo.
echo ⏹️ Backend arrêté.
pause 