# Script de test d'accessibilité Redis
# Teste Redis localement et depuis le site déployé

param(
    [string]$BackendUrl = "http://localhost:3000",
    [string]$RedisUrl = "",
    [switch]$LocalOnly = $false,
    [switch]$Production = $false
)

Write-Host "🔍 Test d'accessibilité Redis" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Si production, utiliser l'URL Render
if ($Production) {
    $BackendUrl = "https://yukpomnang.onrender.com"
    Write-Host "🌐 Mode production: $BackendUrl" -ForegroundColor Yellow
} else {
    Write-Host "🔧 Mode local: $BackendUrl" -ForegroundColor Yellow
}

# Récupérer REDIS_URL depuis l'environnement si non fournie
if ([string]::IsNullOrEmpty($RedisUrl)) {
    $RedisUrl = $env:REDIS_URL
    if ([string]::IsNullOrEmpty($RedisUrl)) {
        $RedisUrl = "redis://127.0.0.1:6379/0"
        Write-Host "⚠️ REDIS_URL non définie, utilisation par défaut: $RedisUrl" -ForegroundColor Yellow
    } else {
        Write-Host "✅ REDIS_URL trouvée dans l'environnement" -ForegroundColor Green
    }
} else {
    Write-Host "✅ REDIS_URL fournie: $($RedisUrl.Substring(0, [Math]::Min(50, $RedisUrl.Length)))..." -ForegroundColor Green
}

# Test 1: Vérifier que le backend est accessible
Write-Host "`n📡 Test 1: Vérification du backend..." -ForegroundColor Green
try {
    $healthResponse = Invoke-RestMethod -Uri "$BackendUrl/healthz" -Method GET -TimeoutSec 10
    Write-Host "✅ Backend accessible" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "⚠️ Assurez-vous que le backend est démarré" -ForegroundColor Yellow
    exit 1
}

# Test 2: Tester l'endpoint /health/cache (test Redis via l'API)
Write-Host "`n🔍 Test 2: Test Redis via /health/cache..." -ForegroundColor Green
try {
    $cacheHealthResponse = Invoke-RestMethod -Uri "$BackendUrl/health/cache" -Method GET -TimeoutSec 15
    Write-Host "✅ Endpoint /health/cache accessible" -ForegroundColor Green
    Write-Host "   Status: $($cacheHealthResponse.status)" -ForegroundColor White
    Write-Host "   Message: $($cacheHealthResponse.message)" -ForegroundColor White
    Write-Host "   Write test: $($cacheHealthResponse.write_test)" -ForegroundColor $(if ($cacheHealthResponse.write_test) { "Green" } else { "Red" })
    Write-Host "   Read test: $($cacheHealthResponse.read_test)" -ForegroundColor $(if ($cacheHealthResponse.read_test) { "Green" } else { "Red" })
    
    if ($cacheHealthResponse.status -eq "operational") {
        Write-Host "`n✅ Redis est opérationnel via l'API" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ Redis est en mode dégradé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur lors du test /health/cache: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Réponse complète: $($_.Exception.Response)" -ForegroundColor Gray
}

# Test 3: Tester directement Redis avec redis-cli si disponible (local seulement)
if (-not $Production) {
    Write-Host "`n🔧 Test 3: Test direct Redis avec redis-cli (si disponible)..." -ForegroundColor Green
    $redisCliPath = Get-Command redis-cli -ErrorAction SilentlyContinue
    if ($redisCliPath) {
        try {
            # Extraire les informations de l'URL Redis
            $redisHost = "127.0.0.1"
            $redisPort = 6379
            $redisDb = 0
            
            if ($RedisUrl -match "redis://([^:]+):(\d+)/(\d+)") {
                $redisHost = $matches[1]
                $redisPort = [int]$matches[2]
                $redisDb = [int]$matches[3]
            } elseif ($RedisUrl -match "rediss://([^@]+)@([^:]+):(\d+)/(\d+)") {
                # Format rediss://username:password@host:port/db
                $redisHost = $matches[2]
                $redisPort = [int]$matches[3]
                $redisDb = [int]$matches[3]
                Write-Host "   ⚠️ Redis avec TLS (rediss://) détecté - test direct limité" -ForegroundColor Yellow
                Write-Host "   Utilisez le test via /health/redis pour un test complet" -ForegroundColor Yellow
            }
            
            # Tester PING
            $pingResult = & redis-cli -h $redisHost -p $redisPort -n $redisDb PING 2>&1
            if ($LASTEXITCODE -eq 0 -and $pingResult -eq "PONG") {
                Write-Host "✅ Redis PING réussi directement" -ForegroundColor Green
            } else {
                Write-Host "❌ Redis PING échoué: $pingResult" -ForegroundColor Red
            }
        } catch {
            Write-Host "⚠️ Impossible de tester Redis directement: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "   (redis-cli peut ne pas être installé ou configuré)" -ForegroundColor Gray
        }
    } else {
        Write-Host "ℹ️ redis-cli non disponible dans le PATH" -ForegroundColor Gray
        Write-Host "   Installation: choco install redis-64 ou télécharger depuis redis.io" -ForegroundColor Gray
    }
}

# Test 4: Tester avec curl/Invoke-WebRequest pour un endpoint Redis dédié si disponible
Write-Host "`n🌐 Test 4: Test endpoint Redis dédié (/health/redis)..." -ForegroundColor Green
try {
    $redisHealthResponse = Invoke-RestMethod -Uri "$BackendUrl/health/redis" -Method GET -TimeoutSec 15
    Write-Host "✅ Endpoint /health/redis accessible" -ForegroundColor Green
    Write-Host "   Status: $($redisHealthResponse.status)" -ForegroundColor White
    Write-Host "   Message: $($redisHealthResponse.message)" -ForegroundColor White
    if ($redisHealthResponse.ping_test) {
        Write-Host "   Ping test: $($redisHealthResponse.ping_test)" -ForegroundColor Green
    }
    if ($redisHealthResponse.connection_time_ms) {
        Write-Host "   Connection time: $($redisHealthResponse.connection_time_ms) ms" -ForegroundColor White
    }
    if ($redisHealthResponse.error) {
        Write-Host "   Error: $($redisHealthResponse.error)" -ForegroundColor Red
    }
} catch {
    # Endpoint peut ne pas exister encore
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "ℹ️ Endpoint /health/redis non disponible (404)" -ForegroundColor Yellow
        Write-Host "   Utilisez /health/cache pour tester Redis" -ForegroundColor Gray
    } else {
        Write-Host "⚠️ Erreur lors du test /health/redis: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Résumé
Write-Host "`n📊 Résumé des tests:" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Backend URL: $BackendUrl" -ForegroundColor White
Write-Host "Redis URL: $($RedisUrl.Substring(0, [Math]::Min(50, $RedisUrl.Length)))..." -ForegroundColor White

Write-Host "`n✅ Tests terminés" -ForegroundColor Green
Write-Host "💡 Pour plus de détails, vérifiez les logs du backend" -ForegroundColor Yellow