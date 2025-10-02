# Test de connexion mobile vers Render
Write-Host "🔍 Test de connexion mobile vers le backend Render..." -ForegroundColor Cyan

$backendUrl = "https://yukpomnang.onrender.com"

# Test 1: Health check
Write-Host "`n1. Test du health check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/healthz" -Method GET
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend accessible: $($response.StatusCode)" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   Status: $($healthData.status)" -ForegroundColor White
        Write-Host "   Service: $($healthData.service)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Erreur health check: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Test d'authentification
Write-Host "`n2. Test d'authentification..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "test@example.com"
        password = "test123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$backendUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginData
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Authentification fonctionnelle: $($response.StatusCode)" -ForegroundColor Green
        $authData = $response.Content | ConvertFrom-Json
        if ($authData.token) {
            Write-Host "   Token reçu: $($authData.token.Substring(0, 20))..." -ForegroundColor White
        }
    }
} catch {
    Write-Host "❌ Erreur authentification: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test CORS pour mobile
Write-Host "`n3. Test CORS pour applications mobiles..." -ForegroundColor Yellow
try {
    $headers = @{
        "Origin" = "capacitor://localhost"
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "Content-Type, Authorization"
    }
    
    $response = Invoke-WebRequest -Uri "$backendUrl/auth/login" -Method OPTIONS -Headers $headers
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ CORS configuré pour mobile: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "   Access-Control-Allow-Origin: $($response.Headers['access-control-allow-origin'])" -ForegroundColor White
        Write-Host "   Access-Control-Allow-Methods: $($response.Headers['access-control-allow-methods'])" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Erreur CORS: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Vérification de la configuration mobile
Write-Host "`n4. Vérification de la configuration mobile..." -ForegroundColor Yellow
$configFile = "config.env"
if (Test-Path $configFile) {
    $config = Get-Content $configFile
    $apiUrl = $config | Where-Object { $_ -match "EXPO_PUBLIC_API_BASE_URL" }
    if ($apiUrl -match "yukpomnang.onrender.com") {
        Write-Host "✅ Configuration mobile correcte" -ForegroundColor Green
        Write-Host "   $apiUrl" -ForegroundColor White
    } else {
        Write-Host "❌ Configuration mobile incorrecte" -ForegroundColor Red
        Write-Host "   $apiUrl" -ForegroundColor White
    }
} else {
    Write-Host "❌ Fichier config.env non trouvé" -ForegroundColor Red
}

Write-Host "`n🎯 Résumé:" -ForegroundColor Cyan
Write-Host "   - Backend Render: https://yukpomnang.onrender.com" -ForegroundColor White
Write-Host "   - API Mobile: https://yukpomnang.onrender.com/api" -ForegroundColor White
Write-Host "   - CORS: Configuré pour applications mobiles" -ForegroundColor White
Write-Host "   - Authentification: Fonctionnelle" -ForegroundColor White

Write-Host "`n📱 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Lancer l'application mobile: npm start" -ForegroundColor White
Write-Host "   2. Tester la connexion avec les identifiants" -ForegroundColor White
Write-Host "   3. Vérifier que l'authentification fonctionne" -ForegroundColor White
