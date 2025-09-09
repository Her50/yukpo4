# Script simple pour lancer Backend + Microservice Yukpo
# Usage: .\start_backend_microservice_simple.ps1

Write-Host "🚀 Lancement simple Backend + Microservice" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# Vérification rapide
if (-not (Test-Path "backend\Cargo.toml")) {
    Write-Host "❌ Cargo.toml non trouvé dans backend/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "microservice_embedding\main.py")) {
    Write-Host "❌ main.py non trouvé dans microservice_embedding/" -ForegroundColor Red
    exit 1
}

# Configuration des variables d'environnement
$env:EMBEDDING_API_URL = "http://localhost:8000"
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
$env:DATABASE_URL = "postgres://postgres:Hernandez87@localhost:5432/yukpo_db"
$env:HOST = "127.0.0.1"
$env:PORT = "3001"
$env:ENVIRONMENT = "development"
$env:RUST_LOG = "info"

Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green

# Démarrage du microservice en arrière-plan
Write-Host "`n🐍 Démarrage du microservice (port 8000)..." -ForegroundColor Cyan
$microserviceJob = Start-Job -ScriptBlock {
    Set-Location "microservice_embedding"
    if (Test-Path "venv\Scripts\Activate.ps1") {
        & "venv\Scripts\Activate.ps1"
    }
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
} -Name "MicroserviceEmbedding"

# Attendre 3 secondes
Start-Sleep -Seconds 3

# Démarrage du backend
Write-Host "🦀 Démarrage du backend (port 3001)..." -ForegroundColor Cyan
Set-Location "backend"
cargo run

# Le script s'arrête ici car cargo run bloque le terminal 