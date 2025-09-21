#!/usr/bin/env pwsh
# Diagnostic complet des problèmes API Yukpomnang

$FRONTEND_URL = "https://yukpo.vercel.app"
$BACKEND_URL = "https://yukpomnang.onrender.com"

Write-Host "🔍 DIAGNOSTIC API YUKPOMNANG" -ForegroundColor Cyan
Write-Host "Frontend: $FRONTEND_URL" -ForegroundColor Yellow
Write-Host "Backend: $BACKEND_URL" -ForegroundColor Yellow

# Test 1: Backend direct
Write-Host "`n[1] Test Backend Direct..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/healthz" -TimeoutSec 10
    Write-Host "✅ Backend direct: $($response.StatusCode) - $($response.Content)" -ForegroundColor Green
    Write-Host "Headers CORS:" -ForegroundColor Gray
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*cors*" -or $_.Key -like "*access-control*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Backend direct: $_" -ForegroundColor Red
}

# Test 2: Frontend direct
Write-Host "`n[2] Test Frontend Direct..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri $FRONTEND_URL -TimeoutSec 10
    Write-Host "✅ Frontend direct: $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content -match "yukpo|Yukpo") {
        Write-Host "✅ Contenu Yukpo détecté" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Contenu inattendu" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Frontend direct: $_" -ForegroundColor Red
}

# Test 3: Proxy Vercel vers Backend
Write-Host "`n[3] Test Proxy Vercel..." -ForegroundColor Green
$proxyEndpoints = @(
    "/healthz",
    "/auth/login",
    "/api/services",
    "/services/filter"
)

foreach ($endpoint in $proxyEndpoints) {
    try {
        Write-Host "Testing $FRONTEND_URL$endpoint" -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri "$FRONTEND_URL$endpoint" -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✅ $endpoint : $($response.StatusCode)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host "⚠️ $endpoint : $statusCode" -ForegroundColor Yellow
        } else {
            Write-Host "❌ $endpoint : $_" -ForegroundColor Red
        }
    }
}

# Test 4: Test avec authentification
Write-Host "`n[4] Test Authentification..." -ForegroundColor Green
try {
    $loginData = @{
        email = "test@example.com"
        password = "test123"
    } | ConvertTo-Json
    
    # Test direct backend
    Write-Host "Auth Backend direct..." -ForegroundColor Gray
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/auth/login" -Method POST `
        -Body $loginData -ContentType "application/json" -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Auth Backend direct: OK" -ForegroundColor Green
        $token = ($response.Content | ConvertFrom-Json).token
        Write-Host "Token: $($token.Substring(0,30))..." -ForegroundColor Gray
        
        # Test route protégée avec token
        Write-Host "Test route protégée..." -ForegroundColor Gray
        $headers = @{ "Authorization" = "Bearer $token" }
        $protectedResponse = Invoke-WebRequest -Uri "$BACKEND_URL/services/filter" -Headers $headers -TimeoutSec 10
        Write-Host "✅ Route protégée: $($protectedResponse.StatusCode)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Auth: $_" -ForegroundColor Red
}

# Test 5: Vérification configuration Vercel
Write-Host "`n[5] Vérification Configuration..." -ForegroundColor Green
if (Test-Path "frontend/vercel.json") {
    Write-Host "✅ vercel.json existe" -ForegroundColor Green
    $vercelConfig = Get-Content "frontend/vercel.json" | ConvertFrom-Json
    Write-Host "Rewrites configurés:" -ForegroundColor Gray
    $vercelConfig.rewrites | ForEach-Object {
        Write-Host "  $($_.source) → $($_.destination)" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ vercel.json manquant" -ForegroundColor Red
}

# Test 6: Variables d'environnement
Write-Host "`n[6] Variables d'environnement..." -ForegroundColor Green
if (Test-Path "frontend/.env.production") {
    Write-Host "✅ .env.production existe" -ForegroundColor Green
    $envContent = Get-Content "frontend/.env.production"
    $apiUrl = $envContent | Where-Object { $_ -match "VITE_API_BASE_URL" }
    Write-Host "API URL configurée: $apiUrl" -ForegroundColor Gray
} else {
    Write-Host "❌ .env.production manquant" -ForegroundColor Red
}

Write-Host "`n📊 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "1. Vérifiez que les rewrites Vercel fonctionnent" -ForegroundColor White
Write-Host "2. Vérifiez la configuration CORS" -ForegroundColor White
Write-Host "3. Vérifiez les variables d'environnement" -ForegroundColor White
Write-Host "4. Redéployez si nécessaire" -ForegroundColor White 