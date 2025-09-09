# Script de vérification de l'état des services Yukpo
Write-Host "🔍 Vérification de l'état des services Yukpo" -ForegroundColor Green
Write-Host ""

# Vérifier le backend
Write-Host "🔧 Backend (Port 3001):" -ForegroundColor Cyan
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 5 -ErrorAction Stop
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Backend en ligne" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Backend répond mais avec un statut inattendu: $($backendResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Backend hors ligne ou non accessible" -ForegroundColor Red
    Write-Host "      Assurez-vous que le backend est démarré avec 'cargo run' dans le dossier backend/" -ForegroundColor Gray
}

# Vérifier le frontend
Write-Host "🎨 Frontend (Port 5173):" -ForegroundColor Cyan
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 5 -ErrorAction Stop
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend en ligne" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Frontend répond mais avec un statut inattendu: $($frontendResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Frontend hors ligne ou non accessible" -ForegroundColor Red
    Write-Host "      Assurez-vous que le frontend est démarré avec 'npm run dev' dans le dossier frontend/" -ForegroundColor Gray
}

# Vérifier la configuration
Write-Host "⚙️  Configuration:" -ForegroundColor Cyan
if (Test-Path "frontend/.env") {
    Write-Host "   ✅ Fichier .env présent" -ForegroundColor Green
    
    $envContent = Get-Content "frontend/.env"
    $apiKeyLine = $envContent | Where-Object { $_ -match "VITE_APP_GOOGLE_MAPS_API_KEY" }
    if ($apiKeyLine -match "VOTRE_CLE_API_GOOGLE_MAPS") {
        Write-Host "   ⚠️  Clé API Google Maps non configurée" -ForegroundColor Yellow
        Write-Host "      Configurez votre clé dans frontend/.env" -ForegroundColor Gray
    } else {
        Write-Host "   ✅ Clé API Google Maps configurée" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ Fichier .env manquant" -ForegroundColor Red
    Write-Host "      Exécutez le script de configuration" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📊 Résumé:" -ForegroundColor Cyan
Write-Host "   • Backend: http://localhost:3001" -ForegroundColor White
Write-Host "   • Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   • API Documentation: http://localhost:3001/docs" -ForegroundColor White 