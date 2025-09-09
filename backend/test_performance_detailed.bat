@echo off
echo 🧪 Test de performance détaillé avec logs de temps
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

echo 🚀 Lancement du test de performance détaillé...
echo.

echo 💡 Ce test va :
echo    - Mesurer chaque étape de l'orchestration IA
echo    - Identifier les goulots d'étranglement
echo    - Analyser les temps d'exécution IA externe
echo    - Fournir des recommandations d'optimisation
echo.

echo ⚠️  IMPORTANT : Assurez-vous que :
echo    - Le backend Rust est démarré avec les logs détaillés
echo    - Le microservice embedding est actif
echo    - MongoDB est accessible
echo    - Vous avez un token utilisateur valide
echo.

REM Lancer le test
python test_performance_detailed.py

echo.
echo 📊 Test terminé !
echo.
echo 💡 Pour analyser les résultats :
echo    1. Vérifiez les logs du backend Rust
echo    2. Cherchez les sections [TIMING]
echo    3. Identifiez les étapes les plus lentes
echo    4. Optimisez en priorité les goulots d'étranglement
echo.
pause 