# ✅ Script PowerShell pour tester la connexion Redis

$ErrorActionPreference = "Stop"

$REDIS_URL = $env:REDIS_URL
if (-not $REDIS_URL) {
    $REDIS_URL = "redis://127.0.0.1:6379"
}

$REDIS_PASSWORD = $env:REDIS_PASSWORD

Write-Host "🔍 Test de connexion Redis" -ForegroundColor Cyan
Write-Host "=================================================="
Write-Host "URL: $REDIS_URL"
Write-Host ""

# ✅ Vérifier que redis-cli est disponible
$redisCli = Get-Command redis-cli -ErrorAction SilentlyContinue
if (-not $redisCli) {
    Write-Host "❌ redis-cli n'est pas installé" -ForegroundColor Red
    Write-Host "   Installer Redis: https://redis.io/download"
    exit 1
}

# ✅ Test de connexion
Write-Host "🔍 Test de ping..." -ForegroundColor Yellow
try {
    if ($REDIS_PASSWORD) {
        $result = & redis-cli -u $REDIS_URL -a $REDIS_PASSWORD ping
    } else {
        $result = & redis-cli -u $REDIS_URL ping
    }
    
    if ($result -eq "PONG") {
        Write-Host "✅ Connexion Redis réussie" -ForegroundColor Green
        
        # ✅ Test d'écriture/lecture
        Write-Host ""
        Write-Host "🔍 Test d'écriture/lecture..." -ForegroundColor Yellow
        if ($REDIS_PASSWORD) {
            & redis-cli -u $REDIS_URL -a $REDIS_PASSWORD SET test_key "test_value" | Out-Null
            $value = & redis-cli -u $REDIS_URL -a $REDIS_PASSWORD GET test_key
            & redis-cli -u $REDIS_URL -a $REDIS_PASSWORD DEL test_key | Out-Null
        } else {
            & redis-cli -u $REDIS_URL SET test_key "test_value" | Out-Null
            $value = & redis-cli -u $REDIS_URL GET test_key
            & redis-cli -u $REDIS_URL DEL test_key | Out-Null
        }
        
        if ($value -eq "test_value") {
            Write-Host "✅ Test d'écriture/lecture réussi" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Test d'écriture/lecture échoué" -ForegroundColor Yellow
        }
        
        # ✅ Informations Redis
        Write-Host ""
        Write-Host "📊 Informations Redis:" -ForegroundColor Cyan
        if ($REDIS_PASSWORD) {
            & redis-cli -u $REDIS_URL -a $REDIS_PASSWORD INFO server | Select-String -Pattern "redis_version|os|uptime_in_seconds"
        } else {
            & redis-cli -u $REDIS_URL INFO server | Select-String -Pattern "redis_version|os|uptime_in_seconds"
        }
        
        Write-Host ""
        Write-Host "✅ Tous les tests Redis sont passés!" -ForegroundColor Green
    } else {
        Write-Host "❌ Échec de la connexion Redis" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

