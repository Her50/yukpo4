# Script simple pour lancer les services Yukpo (Backend + Embedding)
# Usage: .\start_services_simple.ps1

Write-Host "=== Demarrage des services Yukpo ===" -ForegroundColor Green

# Verifier que nous sommes dans le bon repertoire
if (-not (Test-Path "backend") -or -not (Test-Path "microservice_embedding")) {
    Write-Host "ERREUR: Repertoires backend et microservice_embedding non trouves" -ForegroundColor Red
    Write-Host "Assurez-vous d'etre dans le repertoire racine du projet Yukpo" -ForegroundColor Yellow
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "- Backend: Port 3001" -ForegroundColor White
Write-Host "- Embedding: Port 8000" -ForegroundColor White

# Demarrer le microservice d'embedding en arriere-plan
Write-Host "`n1. Demarrage du microservice d'embedding..." -ForegroundColor Cyan
Set-Location "microservice_embedding"

# Verifier l'environnement virtuel
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activation de l'environnement virtuel..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
} else {
    Write-Host "Environnement virtuel non trouve, utilisation de Python global" -ForegroundColor Yellow
}

# Lancer le microservice en arriere-plan
Write-Host "Lancement du microservice sur le port 8000..." -ForegroundColor Yellow
Start-Job -ScriptBlock {
    Set-Location "microservice_embedding"
    if (Test-Path "venv\Scripts\Activate.ps1") {
        & "venv\Scripts\Activate.ps1"
    }
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
} -Name "EmbeddingService"

Set-Location ".."

# Attendre que le microservice demarre
Write-Host "Attente du demarrage du microservice (5 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Demarrer le backend Rust
Write-Host "`n2. Demarrage du backend Rust..." -ForegroundColor Cyan
Set-Location "backend"

# Configurer les variables d'environnement pour l'embedding
$env:EMBEDDING_API_URL = "http://localhost:8000"
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"

Write-Host "Variables d'environnement configurees:" -ForegroundColor Yellow
Write-Host "- EMBEDDING_API_URL: $env:EMBEDDING_API_URL" -ForegroundColor White
Write-Host "- YUKPO_API_KEY: $env:YUKPO_API_KEY" -ForegroundColor White

Write-Host "Lancement du backend sur le port 3001..." -ForegroundColor Yellow
cargo run

# Le script s'arrete ici car cargo run bloque le terminal
# Les deux services tournent maintenant dans le meme environnement 