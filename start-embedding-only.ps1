# Script pour demarrer uniquement le microservice d'embedding
Write-Host "Demarrage du microservice d'embedding..." -ForegroundColor Green

# Aller dans le dossier microservice_embedding
Set-Location microservice_embedding

# Activer l'environnement virtuel
Write-Host "Activation de l'environnement virtuel..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1

Write-Host "Demarrage sur le port 8000..." -ForegroundColor Yellow
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload 