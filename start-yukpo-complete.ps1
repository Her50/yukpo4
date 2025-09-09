# Script complet pour demarrer Yukpo avec la configuration existante
# Usage: .\start-yukpo-complete.ps1

Write-Host "Demarrage complet de Yukpo..." -ForegroundColor Green
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
        if ($attempt % 10 -eq 0) {
            Write-Host "Tentative $attempt/$Timeout..." -ForegroundColor Yellow
        }
    }
    Write-Host "Timeout: Service $ServiceName non pret sur le port $Port" -ForegroundColor Red
    return $false
}

# Verifier que le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "ERREUR: Fichier .env non trouve a la racine du projet" -ForegroundColor Red
    Write-Host "Assurez-vous d'avoir un fichier .env avec la configuration necessaire" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration detectee:" -ForegroundColor Yellow
Write-Host "- Backend Rust: Port 3001 (127.0.0.1)" -ForegroundColor White
Write-Host "- Microservice Embedding: Port 8000 (localhost)" -ForegroundColor White
Write-Host "- Frontend: Port 5173 (localhost)" -ForegroundColor White

Write-Host "`nDemarrage des services..." -ForegroundColor Yellow

# 1. Demarrer le microservice d'embedding (port 8000)
Write-Host "`n1. Demarrage du microservice d'embedding (port 8000)..." -ForegroundColor Cyan
if (Test-Port -Port 8000) {
    Write-Host "Le port 8000 est deja utilise" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd microservice_embedding; .\venv\Scripts\Activate.ps1; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal
    Write-Host "Microservice d'embedding lance sur le port 8000" -ForegroundColor Green
}

# Attendre que l'embedding demarre
Start-Sleep -Seconds 5

# 2. Demarrer le backend Rust (port 3001 sur 127.0.0.1)
Write-Host "`n2. Demarrage du backend Rust (port 3001 sur 127.0.0.1)..." -ForegroundColor Cyan
if (Test-Port -Port 3001) {
    Write-Host "Le port 3001 est deja utilise" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; cargo run" -WindowStyle Normal
    Write-Host "Backend Rust lance sur le port 3001" -ForegroundColor Green
}

# Attendre que le backend demarre
Start-Sleep -Seconds 5

# 3. Demarrer le frontend (port 5173)
Write-Host "`n3. Demarrage du frontend (port 5173)..." -ForegroundColor Cyan
if (Test-Port -Port 5173) {
    Write-Host "Le port 5173 est deja utilise" -ForegroundColor Yellow
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal
    Write-Host "Frontend lance sur le port 5173" -ForegroundColor Green
}

# Attendre que le frontend demarre
Start-Sleep -Seconds 5

Write-Host "`nVerification du demarrage des services..." -ForegroundColor Yellow

# Verifier l'etat des services avec des timeouts differents
$embeddingReady = Wait-ForService -Port 8000 -ServiceName "Embedding" -Timeout 30
$backendReady = Wait-ForService -Port 3001 -ServiceName "Backend" -Timeout 120
$frontendReady = Wait-ForService -Port 5173 -ServiceName "Frontend" -Timeout 60

# Afficher l'etat final
Write-Host "`nEtat final des services:" -ForegroundColor Cyan
Write-Host "Embedding (port 8000): $(if $embeddingReady { 'OK' } else { 'KO' })" -ForegroundColor $(if $embeddingReady { 'Green' } else { 'Red' })
Write-Host "Backend (port 3001): $(if $backendReady { 'OK' } else { 'KO' })" -ForegroundColor $(if $backendReady { 'Green' } else { 'Red' })
Write-Host "Frontend (port 5173): $(if $frontendReady { 'OK' } else { 'KO' })" -ForegroundColor $(if $frontendReady { 'Green' } else { 'Red' })

Write-Host "`nURLs d'acces:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "Backend API: http://127.0.0.1:3001" -ForegroundColor White
Write-Host "Backend Docs: http://127.0.0.1:3001/docs" -ForegroundColor White
Write-Host "Embedding API: http://localhost:8000" -ForegroundColor White
Write-Host "Embedding Docs: http://localhost:8000/docs" -ForegroundColor White

Write-Host "`nConfiguration utilisee:" -ForegroundColor Cyan
Write-Host "Fichier .env: $(Get-Item .env).FullName" -ForegroundColor White
Write-Host "DATABASE_URL: $(Get-Content .env | Select-String 'DATABASE_URL' | ForEach-Object { $_.ToString().Split('=')[1] })" -ForegroundColor White
Write-Host "EMBEDDING_API_URL: $(Get-Content .env | Select-String 'EMBEDDING_API_URL' | ForEach-Object { $_.ToString().Split('=')[1] })" -ForegroundColor White

Write-Host "`nPour arreter les services, fermez les fenetres PowerShell ouvertes" -ForegroundColor Yellow
Write-Host "Pour verifier l'etat: .\check-yukpo-status.ps1" -ForegroundColor Yellow 