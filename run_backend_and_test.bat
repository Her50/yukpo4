@echo off
echo 🚀 Script de lancement Backend + Tests Yukpo
echo =============================================
echo.

REM Se placer dans le bon répertoire
cd /d "%~dp0"

echo 📍 Répertoire actuel: %CD%
echo.

echo 🔧 Lancement du backend Rust...
echo 📡 Port: 3001
echo.

REM Lancer le backend dans une nouvelle fenêtre
start "Backend Yukpo" cmd /k "cd /d %CD%\backend && cargo run"

echo ⏳ Attente du démarrage du backend (30 secondes)...
timeout /t 30 /nobreak > nul

echo.
echo 🧪 Lancement des tests Python...
echo.

REM Lancer les tests dans la fenêtre actuelle
python backend/test_optimized_ia.py

echo.
echo ✅ Tests terminés
echo.
echo 💡 Le backend continue de tourner dans l'autre fenêtre
echo 💡 Pour l'arrêter, ferme la fenêtre "Backend Yukpo"
echo.
pause 