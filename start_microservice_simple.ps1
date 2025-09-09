# Script simple pour démarrer le microservice d'embedding
Write-Host "🚀 Démarrage du microservice d'embedding..." -ForegroundColor Green

# Aller dans le répertoire du microservice
Set-Location "microservice_embedding"

# Vérifier que le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "❌ Fichier .env manquant!" -ForegroundColor Red
    exit 1
}

# Démarrer le microservice
Write-Host "📡 Démarrage sur http://localhost:8000" -ForegroundColor Cyan
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload 