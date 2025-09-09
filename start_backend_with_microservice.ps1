# Script pour lancer Backend + Microservice Yukpo
# Usage: .\start_backend_with_microservice.ps1

Write-Host "Lancement Backend + Microservice (version corrigee)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan

# Verification des fichiers
if (-not (Test-Path "backend\Cargo.toml")) {
    Write-Host "Cargo.toml non trouve dans backend/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "microservice_embedding\main.py")) {
    Write-Host "main.py non trouve dans microservice_embedding/" -ForegroundColor Red
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

# Configuration Pinecone CRITIQUE (corrigée)
$env:PINECONE_API_KEY = "pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
$env:PINECONE_ENV = "us-east-1"
$env:PINECONE_INDEX = "service-embeddings"

Write-Host "Variables d'environnement configurees" -ForegroundColor Green

# Demarrage du microservice
Write-Host "`nDemarrage du microservice (port 8000)..." -ForegroundColor Cyan
Write-Host "Repertoire: microservice_embedding" -ForegroundColor Yellow

# Aller dans le repertoire du microservice
Set-Location "microservice_embedding"

# Verifier que le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host ".env non trouve dans microservice_embedding/" -ForegroundColor Red
    exit 1
}

# Demarrer le microservice avec uvicorn
Write-Host "Lancement: uvicorn main:app --host 0.0.0.0 --port 8000" -ForegroundColor Yellow

try {
    # Demarrer uvicorn en arriere-plan avec les variables d'environnement
    $env:PINECONE_API_KEY = "pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
    $env:PINECONE_ENV = "us-east-1"
    $env:PINECONE_INDEX = "service-embeddings"
    $env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
    $env:MATCHING_SCORE_THRESHOLD = "0.5"
    
    $process = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru -WindowStyle Hidden
    
    Write-Host ("Microservice demarre (PID: " + $process.Id + ")") -ForegroundColor Green
    
    # Attendre que le microservice soit pret
    Write-Host "Attente du demarrage du microservice..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5
            Write-Host "Microservice accessible sur http://localhost:8000" -ForegroundColor Green
            break
        } catch {
            Write-Host "Tentative $attempt/$maxAttempts - Microservice pas encore pret..." -ForegroundColor Yellow
        }
    } while ($attempt -lt $maxAttempts)
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "Le microservice n'a pas demarre dans les temps" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "Erreur lors du demarrage du microservice: " -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Retourner au repertoire racine
Set-Location ".."

# Test de communication avec le microservice
Write-Host "`nTest de communication avec le microservice..." -ForegroundColor Yellow
try {
    $headers = @{
        "Content-Type" = "application/json"
        "x-api-key" = "yukpo_embedding_key_2024"
    }
    
    $payload = @{
        query = "test"
        type_donnee = "texte"
        top_k = 1
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 10
    Write-Host "Communication avec le microservice OK" -ForegroundColor Green
} catch {
    Write-Host "Erreur de communication avec le microservice: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Le microservice ne repond pas correctement. Verifiez qu'il est bien demarre." -ForegroundColor Yellow
    exit 1
}

# Demarrage du backend
Write-Host "`nDemarrage du backend (port 3001)..." -ForegroundColor Cyan
Write-Host "Repertoire: backend" -ForegroundColor Yellow

Set-Location "backend"
Write-Host "Lancement: cargo run" -ForegroundColor Yellow

# Demarrer le backend
cargo run 