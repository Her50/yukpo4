# Script pour redemarrer Yukpo
Write-Host "Redemarrage de Yukpo..." -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Cyan

# Fonction pour tuer les processus sur les ports
function Stop-ProcessOnPort {
    param([int]$Port)
    $processes = netstat -ano | findstr ":$Port"
    if ($processes) {
        Write-Host "Arret des processus sur le port $Port..." -ForegroundColor Yellow
        $processes | ForEach-Object {
            $parts = $_ -split '\s+'
            $pid = $parts[-1]
            if ($pid -and $pid -ne "0") {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    Write-Host "Processus $pid arrete" -ForegroundColor Green
                } catch {
                    Write-Host "Impossible d'arreter le processus $pid" -ForegroundColor Yellow
                }
            }
        }
    }
}

# Arreter les services existants
Write-Host "Arret des services existants..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 8000  # Embedding
Stop-ProcessOnPort -Port 3001  # Backend
Stop-ProcessOnPort -Port 5173  # Frontend

# Attendre un peu
Start-Sleep -Seconds 3

# Redemarrer les services
Write-Host "`nRedemarrage des services..." -ForegroundColor Yellow

# 1. Microservice d'embedding
Write-Host "1. Microservice d'embedding (port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd microservice_embedding; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

# 2. Backend Rust
Write-Host "2. Backend Rust (port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run" -WindowStyle Normal

# 3. Frontend
Write-Host "3. Frontend (port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host "`nServices en cours de redemarrage..." -ForegroundColor Green
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend: http://127.0.0.1:3001" -ForegroundColor White
Write-Host "Embedding: http://localhost:8000" -ForegroundColor White

Write-Host "`nPour verifier l'etat: .\check-yukpo-status.ps1" -ForegroundColor Yellow 