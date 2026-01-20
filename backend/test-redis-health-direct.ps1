# Script pour tester directement la connexion Redis via /health/redis
# Usage: powershell -ExecutionPolicy Bypass -File test-redis-health-direct.ps1

$maxRetries = 20
$retryDelay = 2
$serverStarted = $false

Write-Host "🔍 Test de connexion Redis via /health/redis" -ForegroundColor Cyan
Write-Host ""

# Vérifier si le serveur est déjà démarré
Write-Host "🔍 Vérification du serveur backend sur le port 8080..." -ForegroundColor Yellow

for ($i = 1; $i -le 3; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -Method GET -TimeoutSec 2 -ErrorAction Stop
        $serverStarted = $true
        Write-Host "✅ Serveur backend déjà démarré" -ForegroundColor Green
        Write-Host ""
        break
    }
    catch {
        # Serveur non démarré, continuer
    }
}

if (-not $serverStarted) {
    Write-Host "⚠️ Serveur backend non démarré" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Options:" -ForegroundColor Cyan
    Write-Host "   1. Démarrez le serveur dans un autre terminal:" -ForegroundColor White
    Write-Host "      cd backend" -ForegroundColor Gray
    Write-Host "      cargo run" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. Attendez quelques secondes et relancez ce script" -ForegroundColor White
    Write-Host ""
    
    $startServer = Read-Host "Voulez-vous démarrer le serveur maintenant? (O/N)"
    if ($startServer -eq "O" -or $startServer -eq "o") {
        Write-Host ""
        Write-Host "🚀 Démarrage du serveur backend..." -ForegroundColor Cyan
        Write-Host "   (Cela peut prendre quelques minutes pour la compilation)" -ForegroundColor Yellow
        Write-Host ""
        
        # Démarrer le serveur en arrière-plan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; cargo run" -WindowStyle Normal
        
        Write-Host "⏳ Attente du démarrage du serveur..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
    else {
        Write-Host "❌ Impossible de tester sans serveur démarré" -ForegroundColor Red
        exit 1
    }
}

# Tester la route /health/redis
Write-Host "🔍 Test de la route /health/redis..." -ForegroundColor Cyan
Write-Host ""

for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        Write-Host "   Tentative $i/$maxRetries..." -ForegroundColor Gray
        
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health/redis" -Method GET -ErrorAction Stop
        
        Write-Host ""
        Write-Host "✅ Connexion réussie!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Réponse complète du serveur:" -ForegroundColor Cyan
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        
        # Parser et afficher le JSON de manière lisible
        $jsonResponse = $response.Content | ConvertFrom-Json
        
        Write-Host ""
        Write-Host "Status: " -NoNewline -ForegroundColor Cyan
        $statusColor = switch ($jsonResponse.status) {
            "operational" { "Green" }
            "degraded" { "Yellow" }
            default { "Red" }
        }
        Write-Host $jsonResponse.status -ForegroundColor $statusColor
        
        Write-Host "Message: " -NoNewline -ForegroundColor Cyan
        Write-Host $jsonResponse.message
        
        Write-Host ""
        Write-Host "Tests détaillés:" -ForegroundColor Cyan
        Write-Host "  • PING: " -NoNewline -ForegroundColor White
        Write-Host $(if ($jsonResponse.ping_test) { "✅ OK" } else { "❌ FAIL" }) -ForegroundColor $(if ($jsonResponse.ping_test) { "Green" } else { "Red" })
        
        Write-Host "  • Write: " -NoNewline -ForegroundColor White
        Write-Host $(if ($jsonResponse.write_test) { "✅ OK" } else { "❌ FAIL" }) -ForegroundColor $(if ($jsonResponse.write_test) { "Green" } else { "Red" })
        
        Write-Host "  • Read: " -NoNewline -ForegroundColor White
        Write-Host $(if ($jsonResponse.read_test) { "✅ OK" } else { "❌ FAIL" }) -ForegroundColor $(if ($jsonResponse.read_test) { "Green" } else { "Red" })
        
        Write-Host "  • Pool: " -NoNewline -ForegroundColor White
        Write-Host $(if ($jsonResponse.pool_test) { "✅ OK" } else { "⚠️ N/A" }) -ForegroundColor $(if ($jsonResponse.pool_test) { "Green" } else { "Yellow" })
        
        Write-Host ""
        Write-Host "Métriques:" -ForegroundColor Cyan
        Write-Host "  • Temps de connexion: " -NoNewline -ForegroundColor White
        Write-Host "$($jsonResponse.connection_time_ms) ms" -ForegroundColor $(if ($jsonResponse.connection_time_ms -lt 100) { "Green" } elseif ($jsonResponse.connection_time_ms -lt 500) { "Yellow" } else { "Red" })
        
        Write-Host "  • Redis URL configurée: " -NoNewline -ForegroundColor White
        Write-Host $(if ($jsonResponse.redis_url_configured) { "✅ Oui" } else { "❌ Non" }) -ForegroundColor $(if ($jsonResponse.redis_url_configured) { "Green" } else { "Red" })
        
        Write-Host "  • Pool disponible: " -NoNewline -ForegroundColor White
        Write-Host $(if ($jsonResponse.pool_available) { "✅ Oui" } else { "⚠️ Non" }) -ForegroundColor $(if ($jsonResponse.pool_available) { "Green" } else { "Yellow" })
        
        if ($jsonResponse.timestamp) {
            Write-Host "  • Timestamp: " -NoNewline -ForegroundColor White
            Write-Host $jsonResponse.timestamp
        }
        
        if ($jsonResponse.error) {
            Write-Host ""
            Write-Host "❌ Erreur détectée:" -ForegroundColor Red
            Write-Host "   $($jsonResponse.error)" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📋 JSON brut:" -ForegroundColor Cyan
        Write-Host $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
        
        Write-Host ""
        
        # Résultat final
        if ($jsonResponse.status -eq "operational") {
            Write-Host "✅ Redis est opérationnel!" -ForegroundColor Green
            exit 0
        }
        else {
            Write-Host "⚠️ Redis est en mode dégradé ou non disponible" -ForegroundColor Yellow
            exit 1
        }
    }
    catch {
        if ($i -eq $maxRetries) {
            Write-Host ""
            Write-Host "❌ Impossible de se connecter au serveur après $maxRetries tentatives" -ForegroundColor Red
            Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Write-Host "💡 Vérifiez que:" -ForegroundColor Yellow
            Write-Host "   • Le serveur backend est démarré (cargo run)" -ForegroundColor White
            Write-Host "   • Le serveur écoute sur le port 8080" -ForegroundColor White
            Write-Host "   • REDIS_URL est configuré correctement dans .env" -ForegroundColor White
            Write-Host ""
            exit 1
        }
        
        Write-Host "   ⏳ Attente de $retryDelay secondes..." -ForegroundColor Gray
        Start-Sleep -Seconds $retryDelay
    }
}




