@echo off
REM Script pour lancer le microservice d'embedding et vérifier la connectivité

REM 1. Lancer le microservice d'embedding (si non déjà lancé)
cd /d %~dp0..\microservice_embedding
start "embedding" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8000"

REM 2. Attendre quelques secondes pour laisser le service démarrer
ping 127.0.0.1 -n 6 >nul

REM 3. Vérifier la connectivité sur http://localhost:8000/embedding
cd /d %~dp0
powershell -Command "try { $resp = Invoke-RestMethod -Uri 'http://localhost:8000/embedding' -Method POST -Body '{\"value\":\"ping\",\"type_donnee\":\"texte\"}' -ContentType 'application/json'; Write-Host '✅ Microservice embedding accessible.' -ForegroundColor Green } catch { Write-Host '❌ Microservice embedding INACCESSIBLE sur http://localhost:8000' -ForegroundColor Red; exit 1 }"

REM 4. Pause pour garder la fenêtre ouverte
pause
