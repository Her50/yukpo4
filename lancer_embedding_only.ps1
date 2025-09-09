# Script pour lancer uniquement le microservice d'embedding
# Place ce script à la racine du projet Yukpo

Write-Host "🧠 Démarrage du microservice d'embedding Yukpo..." -ForegroundColor Green

# === 0. Charger les variables d'environnement ===
$envPath = Join-Path $PSScriptRoot "microservice_embedding\.env"

if (Test-Path $envPath) {
    Write-Host "[DEBUG] Chargement des variables d'environnement depuis .env" -ForegroundColor Yellow
    try {
        $envContent = Get-Content $envPath -Encoding UTF8
        foreach ($line in $envContent) {
            if ($line -match '^([^#][^=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                [Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    } catch {
        Write-Host "[ERREUR] Impossible de charger le fichier .env: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERREUR] .env absent dans microservice_embedding" -ForegroundColor Red
    exit 1
}

# === 1. Préparation de l'environnement virtuel Python ===
$microservicePath = Join-Path $PSScriptRoot "microservice_embedding"
Set-Location $microservicePath

$venvPath = Join-Path $microservicePath "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "[PY] Création de l'environnement virtuel Python..." -ForegroundColor Yellow
    & "C:\Python313\python.exe" -m venv venv
}

# Activation de l'environnement virtuel
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
if (-not (Test-Path $activateScript)) {
    Write-Host "[ERREUR] Script d'activation non trouvé" -ForegroundColor Red
    exit 1
}

# Vérification des variables d'environnement
$pineconeKey = [Environment]::GetEnvironmentVariable("PINECONE_API_KEY", "Process")
Write-Host "[DEBUG] PINECONE_API_KEY = $pineconeKey" -ForegroundColor Gray

# === 2. Lancer le microservice embedding ===
Write-Host "[EMBEDDING] Démarrage du microservice embedding..." -ForegroundColor Yellow
Write-Host "[INFO] Le service sera accessible sur http://localhost:8000" -ForegroundColor Cyan
Write-Host "[INFO] Appuyez sur Ctrl+C pour arrêter le service" -ForegroundColor Cyan
Write-Host ""

# Activer l'environnement virtuel et lancer le service
& $activateScript
python -m uvicorn main:app --host 0.0.0.0 --port 8000 