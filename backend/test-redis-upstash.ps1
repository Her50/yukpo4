# Script de test pour vérifier la connexion Redis Upstash
# Base: yukpomnang-cache
# Endpoint: quiet-crawdad-8969.upstash.io

Write-Host "🔍 Test de connexion Redis Upstash..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si REDIS_URL est configuré
$redisUrl = $env:REDIS_URL

if (-not $redisUrl) {
    Write-Host "❌ REDIS_URL non configuré dans les variables d'environnement" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Configurez REDIS_URL avec le format suivant:" -ForegroundColor Yellow
    Write-Host "   rediss://default:VOTRE_TOKEN@quiet-crawdad-8969.upstash.io:6379" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Pour obtenir votre token:" -ForegroundColor Yellow
    Write-Host "   1. Allez sur https://console.upstash.com" -ForegroundColor White
    Write-Host "   2. Sélectionnez yukpomnang-cache" -ForegroundColor White
    Write-Host "   3. Onglet Details > TOKEN" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ REDIS_URL trouvé: $($redisUrl -replace ':[^:@]+@', ':****@')" -ForegroundColor Green
Write-Host ""

# Vérifier si le serveur backend est démarré
Write-Host "🔍 Vérification du serveur backend..." -ForegroundColor Cyan

try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Serveur backend actif" -ForegroundColor Green
    Write-Host ""
    
    # Tester la route /health/redis
    Write-Host "🔍 Test de la route /health/redis..." -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health/redis" -Method GET -ErrorAction Stop
        $redisHealth = $response.Content | ConvertFrom-Json
        
        Write-Host "📊 Résultats du test Redis:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   Status: $($redisHealth.status)" -ForegroundColor $(if ($redisHealth.status -eq 'operational') { 'Green' } else { 'Red' })
        Write-Host "   Message: $($redisHealth.message)" -ForegroundColor White
        Write-Host ""
        Write-Host "   Tests:" -ForegroundColor Cyan
        Write-Host "   - PING: $(if ($redisHealth.ping_test) { '✅ OK' } else { '❌ FAIL' })" -ForegroundColor $(if ($redisHealth.ping_test) { 'Green' } else { 'Red' })
        Write-Host "   - Write: $(if ($redisHealth.write_test) { '✅ OK' } else { '❌ FAIL' })" -ForegroundColor $(if ($redisHealth.write_test) { 'Green' } else { 'Red' })
        Write-Host "   - Read: $(if ($redisHealth.read_test) { '✅ OK' } else { '❌ FAIL' })" -ForegroundColor $(if ($redisHealth.read_test) { 'Green' } else { 'Red' })
        Write-Host "   - Pool: $(if ($redisHealth.pool_test) { '✅ OK' } else { '❌ FAIL' })" -ForegroundColor $(if ($redisHealth.pool_test) { 'Green' } else { 'Red' })
        Write-Host ""
        Write-Host "   Temps de connexion: $($redisHealth.connection_time_ms) ms" -ForegroundColor White
        Write-Host "   Redis URL configurée: $(if ($redisHealth.redis_url_configured) { '✅ Oui' } else { '❌ Non' })" -ForegroundColor $(if ($redisHealth.redis_url_configured) { 'Green' } else { 'Red' })
        Write-Host "   Pool disponible: $(if ($redisHealth.pool_available) { '✅ Oui' } else { '❌ Non' })" -ForegroundColor $(if ($redisHealth.pool_available) { 'Green' } else { 'Yellow' })
        Write-Host ""
        
        if ($redisHealth.error) {
            Write-Host "   ⚠️ Erreur: $($redisHealth.error)" -ForegroundColor Red
            Write-Host ""
        }
        
        if ($redisHealth.status -eq 'operational') {
            Write-Host "✅ Redis est opérationnel!" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "❌ Redis n'est pas opérationnel" -ForegroundColor Red
            exit 1
        }
    }
    catch {
        Write-Host "❌ Erreur lors du test Redis: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Vérifiez que:" -ForegroundColor Yellow
        Write-Host "   - REDIS_URL est correctement configuré dans .env" -ForegroundColor White
        Write-Host "   - Le token Redis est valide" -ForegroundColor White
        Write-Host "   - TLS/SSL est activé (utilisez rediss://)" -ForegroundColor White
        exit 1
    }
}
catch {
    Write-Host "❌ Serveur backend non accessible sur http://localhost:8080" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Démarrez le serveur backend d'abord:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   cargo run" -ForegroundColor White
    Write-Host ""
    exit 1
}




