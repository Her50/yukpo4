# Script PowerShell pour tester la connexion Redis directement
# Teste la connexion sans avoir besoin de compiler le projet

$REDIS_URL = "rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"

Write-Host "🔍 Test de connexion Redis directe" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Extraire les informations de l'URL
$pattern = 'rediss?://([^:]+):([^@]+)@([^:]+):(\d+)(?:/(\d+))?'
if ($REDIS_URL -match $pattern) {
    $username = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = if ($matches[5]) { $matches[5] } else { "0" }
    
    Write-Host "📋 Informations extraites:" -ForegroundColor Yellow
    Write-Host "   Host: $host" -ForegroundColor Gray
    Write-Host "   Port: $port" -ForegroundColor Gray
    Write-Host "   Username: $username" -ForegroundColor Gray
    Write-Host "   Database: $database" -ForegroundColor Gray
    Write-Host "   Protocole: rediss:// (TLS)" -ForegroundColor Green
    Write-Host ""
    
    # Test 1: Vérifier la résolution DNS
    Write-Host "🧪 Test 1: Résolution DNS..." -ForegroundColor Yellow
    try {
        $dnsResult = [System.Net.Dns]::GetHostAddresses($host)
        Write-Host "   ✅ DNS résolu avec succès:" -ForegroundColor Green
        foreach ($ip in $dnsResult) {
            Write-Host "      - $($ip.ToString())" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "   ❌ Erreur DNS: $_" -ForegroundColor Red
        Write-Host "   💡 Le hostname n'est pas résolu. Vérifiez la connexion internet." -ForegroundColor Yellow
        exit 1
    }
    Write-Host ""
    
    # Test 2: Vérifier la connectivité TCP
    Write-Host "🧪 Test 2: Connectivité TCP (port $port)..." -ForegroundColor Yellow
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($host, [int]$port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
        
        if ($wait) {
            try {
                $tcpClient.EndConnect($connect)
                Write-Host "   ✅ Connexion TCP réussie au port $port" -ForegroundColor Green
                $tcpClient.Close()
            }
            catch {
                Write-Host "   ❌ Erreur lors de la connexion TCP: $_" -ForegroundColor Red
            }
        }
        else {
            Write-Host "   ❌ Timeout: Impossible de se connecter au port $port en 5 secondes" -ForegroundColor Red
            Write-Host "   💡 Vérifiez:" -ForegroundColor Yellow
            Write-Host "      - Que le serveur Redis est actif" -ForegroundColor Gray
            Write-Host "      - Les paramètres de firewall" -ForegroundColor Gray
            Write-Host "      - La latence réseau" -ForegroundColor Gray
            $tcpClient.Close()
        }
    }
    catch {
        Write-Host "   ❌ Erreur TCP: $_" -ForegroundColor Red
    }
    Write-Host ""
    
    # Test 3: Vérifier avec Test-NetConnection (si disponible)
    Write-Host "🧪 Test 3: Test-NetConnection..." -ForegroundColor Yellow
    try {
        $testResult = Test-NetConnection -ComputerName $host -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($testResult) {
            Write-Host "   ✅ Port $port accessible" -ForegroundColor Green
        }
        else {
            Write-Host "   ❌ Port $port non accessible" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "   ⚠️  Test-NetConnection non disponible ou échoué" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Test 4: Vérifier avec redis-cli si disponible
    Write-Host "🧪 Test 4: Test avec redis-cli (si disponible)..." -ForegroundColor Yellow
    $redisCliPath = Get-Command redis-cli -ErrorAction SilentlyContinue
    if ($redisCliPath) {
        Write-Host "   ✅ redis-cli trouvé: $($redisCliPath.Source)" -ForegroundColor Green
        Write-Host "   🔄 Tentative de connexion..." -ForegroundColor Gray
        
        # Essayer de se connecter avec redis-cli
        $redisTest = & redis-cli -u $REDIS_URL ping 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Connexion Redis réussie! Réponse: $redisTest" -ForegroundColor Green
        }
        else {
            Write-Host "   ❌ Connexion Redis échouée" -ForegroundColor Red
            Write-Host "   Erreur: $redisTest" -ForegroundColor Red
        }
    }
    else {
        Write-Host "   ⚠️  redis-cli non trouvé dans le PATH" -ForegroundColor Yellow
        Write-Host "   💡 Pour installer redis-cli:" -ForegroundColor Gray
        Write-Host "      Windows: choco install redis-64" -ForegroundColor White
        Write-Host "      Ou télécharger depuis: https://github.com/microsoftarchive/redis/releases" -ForegroundColor White
    }
    Write-Host ""
    
    # Test 5: Vérifier avec curl (API REST Upstash)
    Write-Host "🧪 Test 5: Test avec l'API REST Upstash (si disponible)..." -ForegroundColor Yellow
    $curlPath = Get-Command curl -ErrorAction SilentlyContinue
    if ($curlPath) {
        Write-Host "   ✅ curl trouvé" -ForegroundColor Green
        Write-Host "   💡 Upstash fournit une API REST, mais nécessite l'endpoint REST spécifique" -ForegroundColor Gray
        Write-Host "   💡 L'URL Redis fournie est pour la connexion directe, pas l'API REST" -ForegroundColor Gray
    }
    else {
        Write-Host "   ⚠️  curl non trouvé" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # Résumé
    Write-Host "📊 Résumé des tests:" -ForegroundColor Cyan
    Write-Host "   - DNS: Vérifié" -ForegroundColor Gray
    Write-Host "   - TCP: Vérifié" -ForegroundColor Gray
    Write-Host "   - redis-cli: Testé (si disponible)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "💡 Prochaines étapes:" -ForegroundColor Yellow
    Write-Host "   1. Si DNS/TCP fonctionnent mais redis-cli échoue:" -ForegroundColor Gray
    Write-Host "      → Problème de credentials ou configuration Redis" -ForegroundColor White
    Write-Host "   2. Si DNS/TCP échouent:" -ForegroundColor Gray
    Write-Host "      → Problème réseau/firewall" -ForegroundColor White
    Write-Host "   3. Pour tester avec Rust (après correction compilation):" -ForegroundColor Gray
    Write-Host "      `$env:REDIS_URL=`"$REDIS_URL`"" -ForegroundColor White
    Write-Host "      cargo run --bin test_redis" -ForegroundColor White
    
}
else {
    Write-Host "❌ Erreur: Impossible de parser l'URL Redis" -ForegroundColor Red
    Write-Host '   Format attendu: rediss://username:password@host:port/database' -ForegroundColor Yellow
    exit 1
}

