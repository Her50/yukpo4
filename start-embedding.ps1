# Script pour demarrer le microservice d'embedding
Write-Host "Demarrage du microservice d'embedding..." -ForegroundColor Green

# Aller dans le dossier microservice_embedding
Set-Location microservice_embedding

# Verifier que main.py existe
if (-not (Test-Path "main.py")) {
    Write-Host "Erreur: main.py non trouve dans le dossier microservice_embedding" -ForegroundColor Red
    exit 1
}

# Verifier si l'environnement virtuel existe
if (-not (Test-Path "venv")) {
    Write-Host "Creation de l'environnement virtuel..." -ForegroundColor Yellow
    python -m venv venv
}

# Activer l'environnement virtuel
Write-Host "Activation de l'environnement virtuel..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1

# Installer les dependances si requirements.txt existe
if (Test-Path "requirements.txt") {
    Write-Host "Installation des dependances..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

Write-Host "Demarrage sur le port 8000..." -ForegroundColor Yellow
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload 