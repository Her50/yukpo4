# Script pour demarrer les services sequentiellement
Write-Host "Demarrage sequentiel des services Yukpo..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan

# Fonction pour verifier si un port est utilise
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Fonction pour attendre qu'un service soit pret
function Wait-ForService {
    param([int]$Port, [string]$ServiceName, [int]$Timeout = 60)
    Write-Host "Attente du service $ServiceName sur le port $Port..." -ForegroundColor Yellow
    $attempt = 0
    while ($attempt -lt $Timeout) {
        if (Test-Port -Port $Port) {
            Write-Host "Service $ServiceName pret sur le port $Port" -ForegroundColor Green
            return $true
        }
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host "Tentative $attempt/$Timeout..." -ForegroundColor Yellow
    }
    Write-Host "Timeout: Service $ServiceName non pret sur le port $Port" -ForegroundColor Red
    return $false
}

# 1. Demarrer le microservice d'embedding
Write-Host "`n1. Demarrage du microservice d'embedding (port 8000)..." -ForegroundColor Cyan
if (Test-Port -Port 8000) {
    Write-Host "Le port 8000 est deja utilise" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd microservice_embedding; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal
    if (Wait-ForService -Port 8000 -ServiceName "Embedding" -Timeout 30) {
        Write-Host "Microservice d'embedding demarre avec succes" -ForegroundColor Green
    } else {
        Write-Host "Echec du demarrage du microservice d'embedding" -ForegroundColor Red
    }
}

# 2. Demarrer le backend Rust
Write-Host "`n2. Demarrage du backend Rust (port 8001)..." -ForegroundColor Cyan
if (Test-Port -Port 8001) {
    Write-Host "Le port 8001 est deja utilise" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run" -WindowStyle Normal
    if (Wait-ForService -Port 8001 -ServiceName "Backend" -Timeout 120) {
        Write-Host "Backend Rust demarre avec succes" -ForegroundColor Green
    } else {
        Write-Host "Echec du demarrage du backend Rust" -ForegroundColor Red
    }
}

# 3. Demarrer le frontend
Write-Host "`n3. Demarrage du frontend (port 5173)..." -ForegroundColor Cyan
if (Test-Port -Port 5173) {
    Write-Host "Le port 5173 est deja utilise" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal
    if (Wait-ForService -Port 5173 -ServiceName "Frontend" -Timeout 60) {
        Write-Host "Frontend demarre avec succes" -ForegroundColor Green
    } else {
        Write-Host "Echec du demarrage du frontend" -ForegroundColor Red
    }
}

# Afficher l'etat final
Write-Host "`nEtat final des services:" -ForegroundColor Cyan
Write-Host "Embedding (port 8000): $(if (Test-Port -Port 8000) { 'OK' } else { 'KO' })" -ForegroundColor $(if (Test-Port -Port 8000) { 'Green' } else { 'Red' })
Write-Host "Backend (port 8001): $(if (Test-Port -Port 8001) { 'OK' } else { 'KO' })" -ForegroundColor $(if (Test-Port -Port 8001) { 'Green' } else { 'Red' })
Write-Host "Frontend (port 5173): $(if (Test-Port -Port 5173) { 'OK' } else { 'KO' })" -ForegroundColor $(if (Test-Port -Port 5173) { 'Green' } else { 'Red' })

Write-Host "`nURLs d'acces:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend API: http://127.0.0.1:8001" -ForegroundColor White
Write-Host "Backend Docs: http://127.0.0.1:8001/docs" -ForegroundColor White
Write-Host "Embedding API: http://localhost:8000" -ForegroundColor White
Write-Host "Embedding Docs: http://localhost:8000/docs" -ForegroundColor White 