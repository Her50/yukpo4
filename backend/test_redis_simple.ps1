# Test simple de connexion Redis
# Utilise REDIS_URL de l'environnement si disponible, sinon utilise la nouvelle URL
$REDIS_URL = if ($env:REDIS_URL) { $env:REDIS_URL } else { "rediss://default:ASMJAAImcDIxMmNlMGQ2Y2VmODE0NWU3OTA2ZWE2NThmOTIwNWZiZnAyODk2OQ@quiet-crawdad-8969.upstash.io:6379" }

Write-Host "Test de connexion Redis" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Extraire le hostname de l'URL
if ($REDIS_URL -match '@([^:]+):(\d+)') {
    $hostname = $matches[1]
    $port = [int]$matches[2]
}
else {
    Write-Host "ERREUR: Impossible d'extraire le hostname de l'URL" -ForegroundColor Red
    exit 1
}

Write-Host "Hostname: $hostname" -ForegroundColor Yellow
Write-Host "Port: $port" -ForegroundColor Yellow
Write-Host ""

# Test DNS
Write-Host "Test 1: Resolution DNS..." -ForegroundColor Yellow
try {
    $dns = [System.Net.Dns]::GetHostAddresses($hostname)
    Write-Host "  OK - DNS resolu:" -ForegroundColor Green
    foreach ($ip in $dns) {
        Write-Host "    - $($ip.ToString())" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  ERREUR DNS: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test TCP
Write-Host "Test 2: Connectivite TCP..." -ForegroundColor Yellow
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $connect = $tcp.BeginConnect($hostname, $port, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
    
    if ($wait) {
        try {
            $tcp.EndConnect($connect)
            Write-Host "  OK - Port $port accessible" -ForegroundColor Green
            $tcp.Close()
        }
        catch {
            Write-Host "  ERREUR TCP: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "  TIMEOUT - Port $port non accessible en 5 secondes" -ForegroundColor Red
        Write-Host "  Verifiez firewall ou latence reseau" -ForegroundColor Yellow
        $tcp.Close()
    }
}
catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Write-Host ""

# Test redis-cli
Write-Host "Test 3: Test avec redis-cli..." -ForegroundColor Yellow
$redisCli = Get-Command redis-cli -ErrorAction SilentlyContinue
if ($redisCli) {
    Write-Host "  redis-cli trouve: $($redisCli.Source)" -ForegroundColor Green
    Write-Host "  Tentative de connexion..." -ForegroundColor Gray
    
    $result = & redis-cli -u $REDIS_URL ping 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK - Connexion Redis reussie! Reponse: $result" -ForegroundColor Green
    }
    else {
        Write-Host "  ERREUR - Connexion Redis echouee" -ForegroundColor Red
        Write-Host "  Erreur: $result" -ForegroundColor Red
    }
}
else {
    Write-Host "  redis-cli non trouve" -ForegroundColor Yellow
    Write-Host "  Pour installer: choco install redis-64" -ForegroundColor Gray
}
Write-Host ""

Write-Host "Tests termines!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si DNS et TCP fonctionnent mais redis-cli echoue:" -ForegroundColor Yellow
Write-Host "  -> Probleme de credentials ou configuration Redis" -ForegroundColor White
Write-Host ""
Write-Host "Si DNS ou TCP echouent:" -ForegroundColor Yellow
Write-Host "  -> Probleme reseau/firewall" -ForegroundColor White

