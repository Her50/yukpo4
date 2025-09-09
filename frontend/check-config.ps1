# Script de vérification de la configuration frontend Yukpo
# Vérifie que les ports et la clé Google Maps sont correctement configurés

Write-Host "🔍 Vérification de la configuration frontend Yukpo" -ForegroundColor Cyan
Write-Host ""

# Vérifier si .env existe
if (-not (Test-Path ".env")) {
    Write-Host "❌ Fichier .env manquant !" -ForegroundColor Red
    Write-Host "   Exécutez : .\setup-env.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Fichier .env trouvé" -ForegroundColor Green

# Lire le contenu du .env
$envContent = Get-Content ".env" -Raw

# Vérifier la clé Google Maps
if ($envContent -match "VITE_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here") {
    Write-Host "❌ Clé Google Maps non configurée !" -ForegroundColor Red
    Write-Host "   Remplacez 'your_google_maps_api_key_here' par votre vraie clé" -ForegroundColor Yellow
} else {
    Write-Host "✅ Clé Google Maps configurée" -ForegroundColor Green
}

# Vérifier l'URL de l'API backend
if ($envContent -match "VITE_APP_API_URL=http://127.0.0.1:3001") {
    Write-Host "✅ URL API backend correcte (port 3001)" -ForegroundColor Green
} else {
    Write-Host "⚠️  URL API backend incorrecte ou manquante" -ForegroundColor Yellow
    Write-Host "   Doit être : VITE_APP_API_URL=http://127.0.0.1:3001" -ForegroundColor White
}

# Vérifier l'URL du service d'embedding
if ($envContent -match "VITE_APP_EMBEDDING_URL=http://localhost:8000") {
    Write-Host "✅ URL service embedding correcte (port 8000)" -ForegroundColor Green
} else {
    Write-Host "⚠️  URL service embedding incorrecte ou manquante" -ForegroundColor Yellow
    Write-Host "   Doit être : VITE_APP_EMBEDDING_URL=http://localhost:8000" -ForegroundColor White
}

Write-Host ""
Write-Host "🔧 Configuration vite.config.ts :" -ForegroundColor Cyan

# Vérifier vite.config.ts
if (Test-Path "vite.config.ts") {
    $viteConfig = Get-Content "vite.config.ts" -Raw
    
    if ($viteConfig -match "3001") {
        Write-Host "✅ Proxy vite.config.ts correct (port 3001)" -ForegroundColor Green
    } else {
        Write-Host "❌ Proxy vite.config.ts incorrect" -ForegroundColor Red
    }
} else {
    Write-Host "❌ vite.config.ts manquant" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Résumé des ports attendus :" -ForegroundColor Cyan
Write-Host "   Backend Rust    : 3001" -ForegroundColor White
Write-Host "   Service Embedding : 8000" -ForegroundColor White
Write-Host "   Frontend        : 5173 (par défaut Vite)" -ForegroundColor White

Write-Host ""
Write-Host "🚀 Pour démarrer les services :" -ForegroundColor Cyan
Write-Host "   Backend    : cd ..\backend && cargo run" -ForegroundColor White
Write-Host "   Embedding  : cd ..\microservice_embedding && python main.py" -ForegroundColor White
Write-Host "   Frontend   : npm run dev" -ForegroundColor White 