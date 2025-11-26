# Script de diagnostic LiveKit pour Yukpomnang
# Vérifie que le serveur LiveKit est accessible et fonctionnel

Write-Host "🔍 DIAGNOSTIC SERVEUR LIVEKIT" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. Vérifier les variables d'environnement
Write-Host "`n1️⃣ Vérification des variables d'environnement..." -ForegroundColor Yellow

$livekitApiUrl = $env:LIVEKIT_API_URL
$livekitApiKey = $env:LIVEKIT_API_KEY
$livekitApiSecret = $env:LIVEKIT_API_SECRET
$livekitWsUrl = $env:LIVEKIT_WS_URL

if ([string]::IsNullOrWhiteSpace($livekitApiUrl)) {
    Write-Host "   ❌ LIVEKIT_API_URL non définie" -ForegroundColor Red
}
else {
    Write-Host "   ✅ LIVEKIT_API_URL: $livekitApiUrl" -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($livekitApiKey)) {
    Write-Host "   ❌ LIVEKIT_API_KEY non définie" -ForegroundColor Red
}
else {
    $keyPreview = $livekitApiKey.Substring(0, [Math]::Min(10, $livekitApiKey.Length)) + "..."
    Write-Host "   ✅ LIVEKIT_API_KEY: $keyPreview" -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($livekitApiSecret)) {
    Write-Host "   ❌ LIVEKIT_API_SECRET non définie" -ForegroundColor Red
}
else {
    $secretPreview = $livekitApiSecret.Substring(0, [Math]::Min(10, $livekitApiSecret.Length)) + "..."
    Write-Host "   ✅ LIVEKIT_API_SECRET: $secretPreview" -ForegroundColor Green
}

if ([string]::IsNullOrWhiteSpace($livekitWsUrl)) {
    Write-Host "   ⚠️ LIVEKIT_WS_URL non définie (optionnel)" -ForegroundColor Yellow
}
else {
    Write-Host "   ✅ LIVEKIT_WS_URL: $livekitWsUrl" -ForegroundColor Green
}

# Vérifier si toutes les variables requises sont présentes
$allRequired = -not ([string]::IsNullOrWhiteSpace($livekitApiUrl) -or 
    [string]::IsNullOrWhiteSpace($livekitApiKey) -or 
    [string]::IsNullOrWhiteSpace($livekitApiSecret))

if (-not $allRequired) {
    Write-Host "`n❌ Configuration incomplète. Toutes les variables suivantes sont requises:" -ForegroundColor Red
    Write-Host "   - LIVEKIT_API_URL" -ForegroundColor White
    Write-Host "   - LIVEKIT_API_KEY" -ForegroundColor White
    Write-Host "   - LIVEKIT_API_SECRET" -ForegroundColor White
    Write-Host "`n💡 Configurez ces variables dans Render.com > Environment Variables" -ForegroundColor Yellow
    exit 1
}

# 2. Tester la connectivité réseau
Write-Host "`n2️⃣ Test de connectivité réseau..." -ForegroundColor Yellow

try {
    $uri = [System.Uri]$livekitApiUrl
    $host = $uri.Host
    $port = if ($uri.Port -ne -1) { $uri.Port } else { if ($uri.Scheme -eq "https") { 443 } else { 80 } }
    
    Write-Host "   Test de connexion à $host`:$port..." -ForegroundColor White
    
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connect = $tcpClient.BeginConnect($host, $port, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
    
    if ($wait) {
        $tcpClient.EndConnect($connect)
        Write-Host "   ✅ Connexion TCP réussie" -ForegroundColor Green
        $tcpClient.Close()
    }
    else {
        Write-Host "   ❌ Timeout de connexion (5s)" -ForegroundColor Red
    }
}
catch {
    Write-Host "   ❌ Erreur de connexion: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Tester l'endpoint de santé LiveKit
Write-Host "`n3️⃣ Test de l'endpoint de santé LiveKit..." -ForegroundColor Yellow

try {
    $healthUrl = "$livekitApiUrl/health"
    Write-Host "   GET $healthUrl" -ForegroundColor White
    
    $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10 -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Serveur LiveKit accessible (Status: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "   Réponse: $($response.Content)" -ForegroundColor Gray
    }
    else {
        Write-Host "   ⚠️ Statut inattendu: $($response.StatusCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "   ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*Connection refused*" -or $_.Exception.Message -like "*tcp connect error*") {
        Write-Host "   💡 Le serveur LiveKit n'est pas accessible à cette URL" -ForegroundColor Yellow
        Write-Host "   💡 Vérifiez que le serveur est démarré et que l'URL est correcte" -ForegroundColor Yellow
    }
    elseif ($_.Exception.Message -like "*Name or service not known*") {
        Write-Host "   💡 Problème DNS - l'URL n'est pas résolvable" -ForegroundColor Yellow
    }
}

# 4. Tester l'authentification avec l'API LiveKit
Write-Host "`n4️⃣ Test d'authentification API LiveKit..." -ForegroundColor Yellow

try {
    # Générer un token JWT pour l'authentification
    # Note: Pour un test complet, il faudrait utiliser le même code que dans utils/livekit.rs
    # Ici on teste juste si l'endpoint répond
    
    $listRoomsUrl = "$livekitApiUrl/twirp/livekit.RoomService/ListRooms"
    Write-Host "   POST $listRoomsUrl" -ForegroundColor White
    
    # Test sans token (devrait retourner 401)
    try {
        $response = Invoke-WebRequest -Uri $listRoomsUrl -Method POST `
            -Headers @{"Content-Type" = "application/json" } `
            -Body '{}' `
            -TimeoutSec 10 `
            -ErrorAction Stop
        
        Write-Host "   ⚠️ Réponse inattendue: $($response.StatusCode)" -ForegroundColor Yellow
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401) {
            Write-Host "   ✅ Endpoint API accessible (401 Unauthorized attendu sans token)" -ForegroundColor Green
        }
        elseif ($statusCode -eq 404) {
            Write-Host "   ⚠️ Endpoint non trouvé (404) - Vérifiez l'URL de l'API" -ForegroundColor Yellow
        }
        else {
            Write-Host "   ⚠️ Statut: $statusCode" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "   ❌ Erreur lors du test d'authentification: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Vérifier le format de l'URL
Write-Host "`n5️⃣ Vérification du format de l'URL..." -ForegroundColor Yellow

if ($livekitApiUrl -notmatch "^https?://") {
    Write-Host "   ❌ L'URL doit commencer par http:// ou https://" -ForegroundColor Red
    Write-Host "   URL actuelle: $livekitApiUrl" -ForegroundColor White
}
else {
    Write-Host "   ✅ Format d'URL valide" -ForegroundColor Green
}

# 6. Résumé
Write-Host "`n📊 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$issues = @()

if ([string]::IsNullOrWhiteSpace($livekitApiUrl)) { $issues += "LIVEKIT_API_URL manquante" }
if ([string]::IsNullOrWhiteSpace($livekitApiKey)) { $issues += "LIVEKIT_API_KEY manquante" }
if ([string]::IsNullOrWhiteSpace($livekitApiSecret)) { $issues += "LIVEKIT_API_SECRET manquante" }

if ($issues.Count -eq 0) {
    Write-Host "✅ Configuration de base: OK" -ForegroundColor Green
}
else {
    Write-Host "❌ Problèmes de configuration détectés:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "   - $issue" -ForegroundColor White
    }
}

Write-Host "`n💡 CONSEILS POUR RÉSOUDRE LES PROBLÈMES:" -ForegroundColor Yellow
Write-Host "1. Vérifiez que toutes les variables sont définies dans Render.com" -ForegroundColor White
Write-Host "2. Pour LiveKit Cloud: Utilisez l'URL fournie par LiveKit (ex: https://your-project.livekit.cloud)" -ForegroundColor White
Write-Host "3. Pour LiveKit self-hosted: Vérifiez que le serveur est démarré et accessible" -ForegroundColor White
Write-Host "4. Les credentials (API_KEY et API_SECRET) doivent correspondre à votre projet LiveKit" -ForegroundColor White
Write-Host "5. Testez manuellement avec curl:" -ForegroundColor White
Write-Host "   curl -X GET $livekitApiUrl/health" -ForegroundColor Gray

Write-Host "`n✅ Diagnostic terminé" -ForegroundColor Green

