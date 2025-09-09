# Script de démarrage complet de l'écosystème Yukpo
# Usage: .\start_yukpo_ecosystem.ps1

Write-Host "🚀 Démarrage de l'écosystème Yukpo complet..." -ForegroundColor Cyan
Write-Host ""

# Étape 1: Démarrer le microservice d'embedding
Write-Host "📦 Étape 1: Démarrage du microservice d'embedding..." -ForegroundColor Yellow

if (Test-Path "microservice_embedding") {
    Set-Location "microservice_embedding"
    
    # Vérifier si le microservice est déjà en cours d'exécution
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Microservice d'embedding déjà en cours d'exécution" -ForegroundColor Green
        }
    } catch {
        Write-Host "🔄 Démarrage du microservice d'embedding..." -ForegroundColor Yellow
        
        # Démarrer le microservice en arrière-plan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\start_embedding_service.ps1" -WindowStyle Normal
        
        # Attendre que le service soit prêt
        Write-Host "⏳ Attente du démarrage du microservice d'embedding..." -ForegroundColor Yellow
        $maxAttempts = 30
        $attempt = 0
        
        while ($attempt -lt $maxAttempts) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 2
                if ($response.StatusCode -eq 200) {
                    Write-Host "✅ Microservice d'embedding prêt" -ForegroundColor Green
                    break
                }
            } catch {
                $attempt++
                Start-Sleep -Seconds 1
                Write-Host "⏳ Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
            }
        }
        
        if ($attempt -eq $maxAttempts) {
            Write-Host "❌ Timeout: Le microservice d'embedding n'a pas démarré" -ForegroundColor Red
            exit 1
        }
    }
    
    Set-Location ".."
} else {
    Write-Host "❌ Dossier microservice_embedding non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Étape 2: Démarrer le backend Rust
Write-Host "🔧 Étape 2: Démarrage du backend Rust..." -ForegroundColor Yellow

if (Test-Path "backend") {
    Set-Location "backend"
    
    # Vérifier si le backend est déjà en cours d'exécution
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Backend Rust déjà en cours d'exécution" -ForegroundColor Green
        }
    } catch {
        Write-Host "🔄 Démarrage du backend Rust..." -ForegroundColor Yellow
        
        # Démarrer le backend avec la configuration d'embedding
        .\start_with_embedding.ps1
    }
    
    Set-Location ".."
} else {
    Write-Host "❌ Dossier backend non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Écosystème Yukpo démarré avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Services disponibles:" -ForegroundColor Cyan
Write-Host "   - Microservice d'embedding: http://localhost:8000" -ForegroundColor White
Write-Host "   - Documentation embedding: http://localhost:8000/docs" -ForegroundColor White
Write-Host "   - Backend Rust: http://localhost:3001" -ForegroundColor White
Write-Host "   - API Backend: http://localhost:3001/api" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Fonctionnalités activées:" -ForegroundColor Cyan
Write-Host "   ✅ Vectorisation automatique des services" -ForegroundColor Green
Write-Host "   ✅ Sauvegarde dans Pinecone" -ForegroundColor Green
Write-Host "   ✅ Recherche sémantique" -ForegroundColor Green
Write-Host "   ✅ Matching intelligent" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Pour tester:" -ForegroundColor Yellow
Write-Host "   1. Créez un service via l'interface" -ForegroundColor Gray
Write-Host "   2. Vérifiez les logs pour les embeddings" -ForegroundColor Gray
Write-Host "   3. Testez la recherche sémantique" -ForegroundColor Gray 