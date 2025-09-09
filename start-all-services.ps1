# Script de démarrage robuste pour Yukpo
# Usage: .\start-all-services.ps1

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipEmbedding
)

Write-Host "🚀 Démarrage des services Yukpo..." -ForegroundColor Green

# Fonction pour vérifier si un port est utilisé
function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection.TcpTestSucceeded
    }
    catch {
        return $false
    }
}

# Fonction pour tuer un processus sur un port
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($process) {
            Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
            Write-Host "✅ Processus sur le port $Port arrêté" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    catch {
        Write-Host "⚠️ Impossible d'arrêter le processus sur le port $Port" -ForegroundColor Yellow
    }
}

# Vérifier et libérer les ports
Write-Host "🔍 Vérification des ports..." -ForegroundColor Cyan

if (Test-Port -Port 3001) {
    Write-Host "⚠️ Port 3001 (backend) déjà utilisé" -ForegroundColor Yellow
    Stop-ProcessOnPort -Port 3001
}

if (Test-Port -Port 5173) {
    Write-Host "⚠️ Port 5173 (frontend) déjà utilisé" -ForegroundColor Yellow
    Stop-ProcessOnPort -Port 5173
}

if (Test-Port -Port 8000) {
    Write-Host "⚠️ Port 8000 (embedding) déjà utilisé" -ForegroundColor Yellow
    Stop-ProcessOnPort -Port 8000
}

# Attendre que les ports soient libérés
Start-Sleep -Seconds 3

# Démarrer le backend
if (-not $SkipBackend) {
    Write-Host "🔧 Démarrage du backend (Rust)..." -ForegroundColor Cyan
    try {
        Set-Location "backend"
        
        # Vérifier que Cargo.toml existe
        if (-not (Test-Path "Cargo.toml")) {
            throw "Cargo.toml non trouvé dans le dossier backend"
        }
        
        # Définir les variables d'environnement
        $env:EMBEDDING_API_URL = "http://localhost:8000"
        $env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
        
        # Démarrer le backend en arrière-plan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cargo run" -WindowStyle Normal
        Write-Host "✅ Backend démarré (port 3001)" -ForegroundColor Green
        
        # Attendre que le backend soit prêt
        Write-Host "⏳ Attente du démarrage du backend..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        Set-Location ".."
    }
    catch {
        Write-Host "❌ Erreur lors du démarrage du backend: $($_.Exception.Message)" -ForegroundColor Red
        Set-Location ".."
    }
}

# Démarrer le microservice embedding
if (-not $SkipEmbedding) {
    Write-Host "🤖 Démarrage du microservice embedding (Python)..." -ForegroundColor Cyan
    try {
        Set-Location "microservice_embedding"
        
        # Vérifier que le dossier existe
        if (-not (Test-Path ".")) {
            throw "Dossier microservice_embedding non trouvé"
        }
        
        # Activer l'environnement virtuel si il existe
        if (Test-Path "venv\Scripts\Activate.ps1") {
            Write-Host "🔧 Activation de l'environnement virtuel..." -ForegroundColor Yellow
            & "venv\Scripts\Activate.ps1"
        }
        
        # Démarrer le service embedding
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn routers.embedding_router:app --host 0.0.0.0 --port 8000" -WindowStyle Normal
        Write-Host "✅ Microservice embedding démarré (port 8000)" -ForegroundColor Green
        
        # Attendre que le service soit prêt
        Start-Sleep -Seconds 5
        
        Set-Location ".."
    }
    catch {
        Write-Host "❌ Erreur lors du démarrage du microservice embedding: $($_.Exception.Message)" -ForegroundColor Red
        Set-Location ".."
    }
}

# Démarrer le frontend
if (-not $SkipFrontend) {
    Write-Host "🎨 Démarrage du frontend (React)..." -ForegroundColor Cyan
    try {
        Set-Location "frontend"
        
        # Vérifier que package.json existe
        if (-not (Test-Path "package.json")) {
            throw "package.json non trouvé dans le dossier frontend"
        }
        
        # Installer les dépendances si nécessaire
        if (-not (Test-Path "node_modules")) {
            Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
            npm install
        }
        
        # Démarrer le frontend
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal
        Write-Host "✅ Frontend démarré (port 5173)" -ForegroundColor Green
        
        Set-Location ".."
    }
    catch {
        Write-Host "❌ Erreur lors du démarrage du frontend: $($_.Exception.Message)" -ForegroundColor Red
        Set-Location ".."
    }
}

# Vérification finale
Write-Host "`n🔍 Vérification finale des services..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

$services = @(
    @{Name="Backend"; Port=3001; URL="http://localhost:3001/health"},
    @{Name="Frontend"; Port=5173; URL="http://localhost:5173"},
    @{Name="Embedding"; Port=8000; URL="http://localhost:8000/health"}
)

foreach ($service in $services) {
    if (Test-Port -Port $service.Port) {
        Write-Host "✅ $($service.Name) est accessible sur le port $($service.Port)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($service.Name) n'est pas accessible sur le port $($service.Port)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Démarrage terminé !" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔧 Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "🤖 Embedding: http://localhost:8000" -ForegroundColor Cyan 