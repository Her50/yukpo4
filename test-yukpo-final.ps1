#!/usr/bin/env pwsh
# Test final de l'application Yukpomnang avec la nouvelle URL

$FRONTEND_URL = "https://yukpo.vercel.app"
$BACKEND_URL = "https://yukpomnang.onrender.com"

Write-Host "🎉 TEST FINAL YUKPOMNANG" -ForegroundColor Cyan
Write-Host "Frontend: $FRONTEND_URL" -ForegroundColor Green
Write-Host "Backend: $BACKEND_URL" -ForegroundColor Green

# Test 1: Frontend accessible
Write-Host "`n[1] Test Frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $FRONTEND_URL -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend accessible" -ForegroundColor Green
        Write-Host "   Taille: $($response.Content.Length) caractères" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erreur Frontend: $_" -ForegroundColor Red
}

# Test 2: Backend via proxy
Write-Host "`n[2] Test Backend via Proxy..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$FRONTEND_URL/healthz" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend accessible via proxy: $($response.Content)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur Proxy: $_" -ForegroundColor Red
}

# Test 3: Authentification
Write-Host "`n[3] Test Authentification..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "test@example.com"
        password = "test123"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$FRONTEND_URL/auth/login" -Method POST `
        -Body $loginData -ContentType "application/json" -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✅ Authentification réussie" -ForegroundColor Green
        Write-Host "   Token: $($result.token.Substring(0,30))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erreur Auth: $_" -ForegroundColor Red
}

Write-Host "`n🚀 APPLICATION YUKPOMNANG DÉPLOYÉE !" -ForegroundColor Cyan
Write-Host "📱 URL Publique: https://yukpo.vercel.app" -ForegroundColor Green
Write-Host "🔧 API Backend: https://yukpomnang.onrender.com" -ForegroundColor Green
Write-Host "💡 Ouvrez https://yukpo.vercel.app dans votre navigateur" -ForegroundColor Yellow 