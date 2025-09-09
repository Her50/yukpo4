# Script de démarrage du backend Yukpo avec configuration d'embedding
# Usage: .\start_with_embedding.ps1

Write-Host "🚀 Démarrage du backend Yukpo avec configuration d'embedding..." -ForegroundColor Cyan

# Configuration des variables d'environnement pour l'embedding
$env:EMBEDDING_API_URL = "http://localhost:8000"
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
$env:EMBEDDING_TIMEOUT_SECONDS = "30"
$env:EMBEDDING_MAX_RETRIES = "3"

Write-Host "✅ Variables d'environnement configurées:" -ForegroundColor Green
Write-Host "   - EMBEDDING_API_URL: $env:EMBEDDING_API_URL" -ForegroundColor White
Write-Host "   - YUKPO_API_KEY: $($env:YUKPO_API_KEY.Substring(0,8))... (longueur: $($env:YUKPO_API_KEY.Length))" -ForegroundColor White
Write-Host "   - EMBEDDING_TIMEOUT_SECONDS: $env:EMBEDDING_TIMEOUT_SECONDS" -ForegroundColor White
Write-Host "   - EMBEDDING_MAX_RETRIES: $env:EMBEDDING_MAX_RETRIES" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Vérification du microservice d'embedding..." -ForegroundColor Yellow

# Vérifier si le microservice d'embedding est accessible
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Microservice d'embedding accessible" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Microservice d'embedding répond mais avec un statut inattendu: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Microservice d'embedding non accessible sur http://localhost:8000" -ForegroundColor Red
    Write-Host "💡 Assurez-vous que le microservice d'embedding est démarré" -ForegroundColor Yellow
    Write-Host "   Commande: cd ../microservice_embedding && python main.py" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Démarrage du backend Rust..." -ForegroundColor Cyan
Write-Host "   Les services créés seront automatiquement vectorisés et envoyés à Pinecone" -ForegroundColor Gray
Write-Host ""

# Démarrer le backend
cargo run 