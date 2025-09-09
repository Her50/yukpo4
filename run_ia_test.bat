@echo off
echo 🚀 Script de test IA optimisée Yukpo
echo ======================================
echo.

REM Se placer dans le bon répertoire
cd /d "%~dp0"

echo 📍 Répertoire actuel: %CD%
echo.

echo 🧪 Lancement du test Python...
echo 📄 Fichier: backend/test_optimized_ia.py
echo.

REM Lancer le test Python
python backend/test_optimized_ia.py

echo.
echo ✅ Test terminé
echo.
pause 