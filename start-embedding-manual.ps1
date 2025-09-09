# Script pour demarrer manuellement le microservice d'embedding
Write-Host "Demarrage manuel du microservice d'embedding..." -ForegroundColor Green

# Aller dans le dossier microservice_embedding
Set-Location microservice_embedding

# Verifier que main.py existe
if (-not (Test-Path "main.py")) {
    Write-Host "Erreur: main.py non trouve dans le dossier microservice_embedding" -ForegroundColor Red
    exit 1
}

# Activer l'environnement virtuel
Write-Host "Activation de l'environnement virtuel..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1

Write-Host "Demarrage du microservice d'embedding sur le port 8001..." -ForegroundColor Yellow

# Demarrer le microservice sur le port 8001
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload 