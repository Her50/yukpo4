# Script corrigé pour lancer Backend + Microservice Yukpo
# Usage: .\start_backend_microservice_fixed.ps1

Write-Host "🚀 Lancement Backend + Microservice (version corrigée)" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan

# Vérification des fichiers
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

# Démarrage du microservice
Write-Host "`n🐍 Démarrage du microservice (port 8000)..." -ForegroundColor Cyan
Write-Host "📁 Répertoire: microservice_embedding" -ForegroundColor Yellow

# Aller dans le répertoire du microservice
Set-Location "microservice_embedding"

# Vérifier que le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env non trouvé dans microservice_embedding/" -ForegroundColor Red
    exit 1
}

# Démarrer le microservice avec uvicorn
Write-Host "🚀 Lancement: uvicorn main:app --host 0.0.0.0 --port 8000" -ForegroundColor Yellow

try {
    # Démarrer uvicorn en arrière-plan
    $process = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru -WindowStyle Hidden
    
    Write-Host "✅ Microservice démarré (PID: $($process.Id))" -ForegroundColor Green
    
    # Attendre que le microservice soit prêt
    Write-Host "⏳ Attente du démarrage du microservice..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    
    do {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5
            Write-Host "✅ Microservice accessible sur http://localhost:8000" -ForegroundColor Green
            break
        } catch {
            Write-Host "⏳ Tentative $attempt/$maxAttempts - Microservice pas encore prêt..." -ForegroundColor Yellow
        }
    } while ($attempt -lt $maxAttempts)
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "❌ Le microservice n'a pas demarre dans les temps" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Erreur lors du demarrage du microservice: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Retourner au répertoire racine
Set-Location ".."

# Démarrage du backend
Write-Host "`n🦀 Démarrage du backend (port 3001)..." -ForegroundColor Cyan
Write-Host "📁 Répertoire: backend" -ForegroundColor Yellow

Set-Location "backend"
Write-Host "🚀 Lancement: cargo run" -ForegroundColor Yellow

# Démarrer le backend
cargo run 