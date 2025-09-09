@echo off
REM Script robuste : lance embedding Python + backend Rust avec environnement virtuel Python
REM Place ce script à la racine du projet Yukpo

REM === 0. Charger toutes les variables d'environnement du .env dans l'environnement courant ===
REM Utilisation d'une méthode plus sûre pour éviter la corruption du fichier
if exist "%~dp0microservice_embedding\.env" (
    echo [DEBUG] Chargement des variables d'environnement depuis .env
    REM Utiliser PowerShell pour charger le .env de manière sûre
    powershell -Command "Get-Content '%~dp0microservice_embedding\.env' | Where-Object { $_ -match '^[^#].*=.*$' } | ForEach-Object { $env:($_.Split('=')[0]) = $_.Split('=',2)[1] }"
) else (
    echo [ERREUR] .env absent dans microservice_embedding
    echo [INFO] Création d'un fichier .env par défaut...
    copy "%~dp0microservice_embedding\env_template.txt" "%~dp0microservice_embedding\.env" >nul
)

REM === 0b. DEBUG: Vérification de la présence et du contenu de .env ===
if exist "%~dp0microservice_embedding\.env" (
    echo [DEBUG] .env présent dans microservice_embedding
    powershell -Command "Get-Content '%~dp0microservice_embedding\.env' | Select-String 'PINECONE_API_KEY' | ForEach-Object { Write-Host '[DEBUG] Contenu .env:' $_ }"
) else (
    echo [ERREUR] .env absent dans microservice_embedding
)

REM === 1. Préparation de l'environnement virtuel Python ===
cd /d %~dp0microservice_embedding
if not exist venv (
    echo [PY] Création de l'environnement virtuel Python...
    C:\Python313\python.exe -m venv venv
)

REM Activation de l'environnement virtuel
call venv\Scripts\activate.bat

REM Upgrade pip et install requirements
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

REM === 1b. Vérification du chargement des variables d'environnement ===
python -c "import os; print('[DEBUG PYTHON] PINECONE_API_KEY =', os.environ.get('PINECONE_API_KEY'))"

REM === 2. Lancer le microservice embedding dans un terminal séparé ===
start "embedding" cmd /k cd /d %~dp0microservice_embedding ^&^& call venv\Scripts\activate.bat ^&^& python -c "import os; print('[DEBUG PYTHON] PINECONE_API_KEY:', os.getenv('PINECONE_API_KEY'))" ^&^& cd /d %~dp0microservice_embedding ^&^& python -m uvicorn main:app --host 0.0.0.0 --port 8000

REM === 3. Lancer le backend Rust dans un terminal séparé ===
cd /d %~dp0backend
start "backend" cmd /k "set RUST_LOG=info && cargo run"

REM === 4. Attendre le démarrage ===
ping 127.0.0.1 -n 8 >nul

REM === 5. Vérifier la connectivité embedding ===
cd /d %~dp0
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:8000/embedding' -Method POST -Body '{\"value\":\"ping\",\"type_donnee\":\"texte\"}' -ContentType 'application/json'; Write-Host '✅ Microservice embedding accessible.' -ForegroundColor Green } catch { Write-Host '❌ Microservice embedding INACCESSIBLE sur http://localhost:8000' -ForegroundColor Red; exit 1 }"

REM === 6. Vérifier la connectivité backend ===
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:3001/health' -Method GET; Write-Host '✅ Backend Yukpo accessible.' -ForegroundColor Green } catch { Write-Host '❌ Backend Yukpo INACCESSIBLE sur http://localhost:3001' -ForegroundColor Red; exit 1 }"

REM === 7. Pause ===
pause
