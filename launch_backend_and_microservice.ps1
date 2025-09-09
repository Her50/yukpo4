# Script de lancement robuste pour Backend + Microservice Yukpo
# Usage: .\launch_backend_and_microservice.ps1

param(
    [switch]$SkipMicroservice,
    [switch]$SkipBackend,
    [switch]$Verbose,
    [int]$BackendPort = 3001,
    [int]$MicroservicePort = 8000
)

# Configuration des couleurs
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Yukpo - Backend + Microservice"

Write-Host "🚀 Lancement Backend + Microservice Yukpo" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan

# Fonction pour vérifier si un port est utilisé
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

# Fonction pour tuer un processus sur un port
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($process) {
            Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
            Write-Host "✅ Processus sur le port $Port arrêté" -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
    }
    catch {
        Write-Host "⚠️ Impossible d'arrêter le processus sur le port $Port" -ForegroundColor Yellow
    }
}

# Fonction pour attendre qu'un service soit prêt
function Wait-ForService {
    param([int]$Port, [string]$ServiceName, [int]$Timeout = 60)
    Write-Host "⏳ Attente du service $ServiceName sur le port $Port..." -ForegroundColor Yellow
    $attempt = 0
    while ($attempt -lt $Timeout) {
        if (Test-Port -Port $Port) {
            Write-Host "✅ Service $ServiceName prêt sur le port $Port" -ForegroundColor Green
            return $true
        }
        $attempt++
        Start-Sleep -Seconds 1
        if ($attempt % 10 -eq 0) {
            Write-Host "   Tentative $attempt/$Timeout..." -ForegroundColor Gray
        }
    }
    Write-Host "❌ Timeout: Service $ServiceName non prêt sur le port $Port" -ForegroundColor Red
    return $false
}

# Vérification de l'environnement
Write-Host "`n🔍 Vérification de l'environnement..." -ForegroundColor Yellow

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "backend") -or -not (Test-Path "microservice_embedding")) {
    Write-Host "❌ ERREUR: Répertoires backend et microservice_embedding non trouvés" -ForegroundColor Red
    Write-Host "   Assurez-vous d'être dans le répertoire racine du projet Yukpo" -ForegroundColor Yellow
    exit 1
}

# Vérifier le fichier .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ Fichier .env non trouvé à la racine" -ForegroundColor Yellow
    Write-Host "   Le backend utilisera les variables d'environnement système" -ForegroundColor Gray
} else {
    Write-Host "✅ Fichier .env trouvé" -ForegroundColor Green
}

# Vérifier Cargo.toml
if (-not (Test-Path "backend\Cargo.toml")) {
    Write-Host "❌ ERREUR: Cargo.toml non trouvé dans le backend" -ForegroundColor Red
    exit 1
}

# Vérifier main.py
if (-not (Test-Path "microservice_embedding\main.py")) {
    Write-Host "❌ ERREUR: main.py non trouvé dans microservice_embedding" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Environnement vérifié" -ForegroundColor Green

# Nettoyer les ports si nécessaire
Write-Host "`n🧹 Nettoyage des ports..." -ForegroundColor Yellow
if (Test-Port -Port $MicroservicePort) {
    Write-Host "⚠️ Port $MicroservicePort déjà utilisé, nettoyage..." -ForegroundColor Yellow
    Stop-ProcessOnPort -Port $MicroservicePort
}

if (Test-Port -Port $BackendPort) {
    Write-Host "⚠️ Port $BackendPort déjà utilisé, nettoyage..." -ForegroundColor Yellow
    Stop-ProcessOnPort -Port $BackendPort
}

# Configuration des variables d'environnement
Write-Host "`n⚙️ Configuration des variables d'environnement..." -ForegroundColor Yellow

# Variables pour le microservice
$env:EMBEDDING_API_URL = "http://localhost:$MicroservicePort"
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"

# Variables pour le backend
$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost:5432/yukpo_db"
$env:JWT_SECRET = "your_jwt_secret_here"
$env:HOST = "127.0.0.1"
$env:PORT = $BackendPort.ToString()
$env:ENVIRONMENT = "development"
$env:RUST_LOG = "info"

Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green

# Démarrage du microservice (si non ignoré)
if (-not $SkipMicroservice) {
    Write-Host "`n🐍 Démarrage du microservice d'embedding..." -ForegroundColor Cyan
    
    # Vérifier l'environnement virtuel
    $venvPath = "microservice_embedding\venv\Scripts\Activate.ps1"
    if (Test-Path $venvPath) {
        Write-Host "   Activation de l'environnement virtuel..." -ForegroundColor Gray
        & $venvPath
    } else {
        Write-Host "   ⚠️ Environnement virtuel non trouvé, utilisation de Python global" -ForegroundColor Yellow
    }
    
    # Lancer le microservice en arrière-plan
    Write-Host "   Lancement sur le port $MicroservicePort..." -ForegroundColor Gray
    $microserviceJob = Start-Job -ScriptBlock {
        param($MicroservicePort)
        Set-Location "microservice_embedding"
        if (Test-Path "venv\Scripts\Activate.ps1") {
            & "venv\Scripts\Activate.ps1"
        }
        python -m uvicorn main:app --host 0.0.0.0 --port $MicroservicePort --reload
    } -ArgumentList $MicroservicePort -Name "MicroserviceEmbedding"
    
    # Attendre que le microservice démarre
    $microserviceReady = Wait-ForService -Port $MicroservicePort -ServiceName "Microservice" -Timeout 30
    if (-not $microserviceReady) {
        Write-Host "❌ Échec du démarrage du microservice" -ForegroundColor Red
        Stop-Job $microserviceJob -ErrorAction SilentlyContinue
        Remove-Job $microserviceJob -ErrorAction SilentlyContinue
        exit 1
    }
    
    Write-Host "✅ Microservice démarré avec succès" -ForegroundColor Green
} else {
    Write-Host "`n⏭️ Microservice ignoré (paramètre -SkipMicroservice)" -ForegroundColor Yellow
}

# Démarrage du backend (si non ignoré)
if (-not $SkipBackend) {
    Write-Host "`n🦀 Démarrage du backend Rust..." -ForegroundColor Cyan
    
    # Vérifier que le microservice est prêt (si lancé)
    if (-not $SkipMicroservice) {
        Write-Host "   Vérification de la connexion au microservice..." -ForegroundColor Gray
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$MicroservicePort/health" -TimeoutSec 5
            Write-Host "   ✅ Microservice accessible" -ForegroundColor Green
        }
        catch {
            Write-Host "   ⚠️ Microservice non accessible, mais continuation..." -ForegroundColor Yellow
        }
    }
    
    # Lancer le backend
    Write-Host "   Lancement sur le port $BackendPort..." -ForegroundColor Gray
    Set-Location "backend"
    
    if ($Verbose) {
        Write-Host "   Mode verbose activé" -ForegroundColor Gray
        cargo run
    } else {
        cargo run
    }
    
    # Le script s'arrête ici car cargo run bloque le terminal
} else {
    Write-Host "`n⏭️ Backend ignoré (paramètre -SkipBackend)" -ForegroundColor Yellow
    Write-Host "`n📊 Services en cours d'exécution:" -ForegroundColor Cyan
    if (-not $SkipMicroservice) {
        Write-Host "   Microservice: http://localhost:$MicroservicePort" -ForegroundColor White
    }
    Write-Host "`n💡 Pour arrêter les services, fermez cette fenêtre ou utilisez Ctrl+C" -ForegroundColor Yellow
}

# Nettoyage en cas d'erreur
trap {
    Write-Host "`n❌ Erreur détectée, nettoyage..." -ForegroundColor Red
    Get-Job -Name "MicroserviceEmbedding" -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
    Get-Job -Name "MicroserviceEmbedding" -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
    exit 1
} 