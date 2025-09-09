# Script pour lancer le microservice d'embedding corrigé
Write-Host "🚀 Lancement du microservice d'embedding Yukpo" -ForegroundColor Green

# Vérification des fichiers
if (-not (Test-Path "microservice_embedding\main_fixed.py")) {
    Write-Host "❌ main_fixed.py non trouvé dans microservice_embedding/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "microservice_embedding\.env")) {
    Write-Host "❌ .env non trouvé dans microservice_embedding/" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichiers vérifiés" -ForegroundColor Green

# Aller dans le répertoire du microservice
Set-Location "microservice_embedding"

Write-Host "🔧 Démarrage du microservice sur http://localhost:8000" -ForegroundColor Cyan

# Démarrer le microservice
try {
    python main_fixed.py
} catch {
    Write-Host "❌ Erreur lors du démarrage: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} 