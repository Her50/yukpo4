@echo off
REM === Charger toutes les variables d'environnement du .env dans l'environnement courant ===
for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0microservice_embedding\.env") do set "%%a=%%b"
REM (Fin ajout)
REM Script pour lancer le microservice d'embedding ET le backend Rust, puis vérifier la connectivité

REM 0. Installer requirements.txt pour le microservice embedding (si besoin)
cd /d %~dp0microservice_embedding
C:\Python313\python.exe -m pip install --upgrade pip
C:\Python313\python.exe -m pip install -r requirements.txt
REM Pause pour s'assurer que l'installation est bien terminée
ping 127.0.0.1 -n 3 >nul

REM 1. Lancer le microservice d'embedding (si non déjà lancé)
start "embedding" cmd /k "C:\Python313\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000"

REM 2. Lancer le backend Rust (API Yukpo)
cd /d %~dp0backend
start "backend" cmd /k "set RUST_LOG=info && cargo run"

REM 3. Attendre quelques secondes pour laisser les services démarrer
ping 127.0.0.1 -n 8 >nul

REM 4. Vérifier la connectivité sur http://localhost:8000/embedding
cd /d %~dp0
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:8000/embedding' -Method POST -Body '{\"value\":\"ping\",\"type_donnee\":\"texte\"}' -ContentType 'application/json'; Write-Host '✅ Microservice embedding accessible.' -ForegroundColor Green } catch { Write-Host '❌ Microservice embedding INACCESSIBLE sur http://localhost:8000' -ForegroundColor Red; exit 1 }"

REM 5. Vérifier la connectivité du backend sur http://localhost:3001/health (si route health implémentée)
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:3001/health' -Method GET; Write-Host '✅ Backend Yukpo accessible.' -ForegroundColor Green } catch { Write-Host '❌ Backend Yukpo INACCESSIBLE sur http://localhost:3001' -ForegroundColor Red; exit 1 }"

REM 6. Pause pour garder la fenêtre ouverte
pause
