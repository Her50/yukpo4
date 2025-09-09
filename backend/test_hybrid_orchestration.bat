@echo off
echo 🧪 Test de la version hybride de l'orchestration IA
echo ================================================
echo.

echo 📋 Vérification des prérequis...
echo.

REM Vérifier si Python est installé
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python n'est pas installé ou pas dans le PATH
    echo    Installez Python depuis https://python.org
    pause
    exit /b 1
)

REM Vérifier si requests est installé
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Module requests non installé, installation...
    pip install requests
    if errorlevel 1 (
        echo ❌ Erreur lors de l'installation de requests
        pause
        exit /b 1
    )
)

echo ✅ Prérequis vérifiés
echo.

echo 🚀 Lancement du test de la version hybride...
echo.

REM Lancer le test
python test_hybrid_orchestration.py

echo.
echo 📊 Test terminé !
echo.
echo 💡 Pour activer la version hybride, assurez-vous que :
echo    - Les optimisations sont activées dans le backend
echo    - Le microservice embedding est démarré
echo    - MongoDB est accessible pour l'historisation
echo.
pause 