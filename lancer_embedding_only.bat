@echo off
echo 🧠 Démarrage du microservice d'embedding Yukpo...

REM === 0. Charger les variables d'environnement ===
if exist "%~dp0microservice_embedding\.env" (
    echo [DEBUG] Chargement des variables d'environnement depuis .env
    powershell -Command "Get-Content '%~dp0microservice_embedding\.env' | Where-Object { $_ -match '^[^#].*=.*$' } | ForEach-Object { $env:($_.Split('=')[0]) = $_.Split('=',2)[1] }"
) else (
    echo [ERREUR] .env absent dans microservice_embedding
    pause
    exit /b 1
)

REM === 1. Préparation de l'environnement virtuel Python ===
cd /d "%~dp0microservice_embedding"

if not exist venv (
    echo [PY] Création de l'environnement virtuel Python...
    C:\Python313\python.exe -m venv venv
)

REM Activation de l'environnement virtuel
call venv\Scripts\activate.bat

REM Vérification des variables d'environnement
python -c "import os; print('[DEBUG] PINECONE_API_KEY =', os.environ.get('PINECONE_API_KEY'))"

REM === 2. Lancer le microservice embedding ===
echo [EMBEDDING] Démarrage du microservice embedding...
echo [INFO] Le service sera accessible sur http://localhost:8000
echo [INFO] Appuyez sur Ctrl+C pour arrêter le service
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 