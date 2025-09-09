# Script simple pour demarrer les services Yukpo
Write-Host "Demarrage des services Yukpo..." -ForegroundColor Green

# Demarrer le backend dans une nouvelle fenetre
Write-Host "Demarrage du backend Rust..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run"

# Attendre un peu
Start-Sleep -Seconds 3

# Demarrer le frontend dans une nouvelle fenetre
Write-Host "Demarrage du frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

# Attendre un peu
Start-Sleep -Seconds 3

# Demarrer le microservice d'embedding dans une nouvelle fenetre
Write-Host "Demarrage du microservice d'embedding..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd microservice_embedding; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

Write-Host "Services en cours de demarrage !" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Documentation: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Embedding: http://localhost:8001" -ForegroundColor Cyan
Write-Host "Embedding Docs: http://localhost:8001/docs" -ForegroundColor Cyan 