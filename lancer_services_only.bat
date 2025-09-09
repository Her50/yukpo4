@echo off
echo 🚀 Démarrage des services Yukpo (Backend + Embedding)...

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
start "embedding" cmd /k cd /d "%~dp0microservice_embedding" ^&^& call venv\Scripts\activate.bat ^&^& python -m uvicorn main:app --host 0.0.0.0 --port 8000

REM === 3. Lancer le backend Rust ===
echo [BACKEND] Démarrage du backend Rust...
start "backend" cmd /k cd /d "%~dp0backend" ^&^& set RUST_LOG=info ^&^& cargo run

REM === 4. Attendre le démarrage ===
echo [WAIT] Attente du démarrage des services (15 secondes)...
ping 127.0.0.1 -n 16 >nul

REM === 5. Vérifier la connectivité ===
echo [TEST] Test de connectivité des services...

REM Test embedding
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:8000/embedding' -Method POST -Body '{\"value\":\"test\",\"type_donnee\":\"texte\"}' -ContentType 'application/json' -TimeoutSec 10; Write-Host '✅ Microservice embedding accessible sur http://localhost:8000' -ForegroundColor Green } catch { Write-Host '❌ Microservice embedding INACCESSIBLE sur http://localhost:8000' -ForegroundColor Red; Write-Host '   Erreur:' `$_.Exception.Message -ForegroundColor Gray }"

REM Test backend
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:3001/health' -Method GET -TimeoutSec 10; Write-Host '✅ Backend Yukpo accessible sur http://localhost:3001' -ForegroundColor Green } catch { Write-Host '❌ Backend Yukpo INACCESSIBLE sur http://localhost:3001' -ForegroundColor Red; Write-Host '   Erreur:' `$_.Exception.Message -ForegroundColor Gray }"

REM === 6. Instructions pour le frontend ===
echo.
echo 🎉 Services démarrés !
echo 📝 Pour lancer le frontend, ouvrez un nouveau terminal et exécutez :
echo    cd frontend
echo    npm run dev
echo.
echo 🌐 Frontend sera accessible sur : http://localhost:5173
echo 🔧 Backend accessible sur : http://localhost:3001
echo 🧠 Embedding accessible sur : http://localhost:8000
echo.
pause 