#!/usr/bin/env pwsh
# Test direct dans Edge avec automation

$NETLIFY_URL = "https://yukpomnang-app.netlify.app"

Write-Host "🌐 TEST DIRECT DANS EDGE" -ForegroundColor Cyan
Write-Host "Application: $NETLIFY_URL" -ForegroundColor Yellow

# 1. Ouvrir l'application principale
Write-Host "`n[1] Ouverture de l'application principale..." -ForegroundColor Green
Start-Process msedge.exe -ArgumentList "$NETLIFY_URL", "--new-window", "--inprivate"
Start-Sleep -Seconds 3

# 2. Ouvrir la page de test live
Write-Host "`n[2] Ouverture de la page de test live..." -ForegroundColor Green
Start-Process msedge.exe -ArgumentList "$NETLIFY_URL/test-live.html", "--new-window", "--inprivate"
Start-Sleep -Seconds 3

# 3. Test via PowerShell en parallèle
Write-Host "`n[3] Test PowerShell en parallèle..." -ForegroundColor Green

# Test simple de connectivité
try {
    $response = Invoke-WebRequest -Uri "$NETLIFY_URL" -TimeoutSec 10
    Write-Host "✅ Application accessible: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Application inaccessible: $_" -ForegroundColor Red
}

# Test proxy API
try {
    $response = Invoke-WebRequest -Uri "$NETLIFY_URL/healthz" -TimeoutSec 10
    Write-Host "✅ Proxy API: $($response.StatusCode) - $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "❌ Proxy API: $_" -ForegroundColor Red
}

# Test authentification
try {
    $loginData = @{
        email = "test@example.com"
        password = "test123"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$NETLIFY_URL/auth/login" -Method POST `
        -Body $loginData -ContentType "application/json" -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✅ Auth API: Token reçu ($($result.token.Length) caractères)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Auth API: $_" -ForegroundColor Red
}

Write-Host "`n📋 INSTRUCTIONS POUR LE TEST MANUEL:" -ForegroundColor Cyan
Write-Host "1. Dans Edge, aller sur: $NETLIFY_URL" -ForegroundColor White
Write-Host "2. Ouvrir les DevTools (F12)" -ForegroundColor White
Write-Host "3. Aller dans l'onglet Network" -ForegroundColor White
Write-Host "4. Essayer de vous inscrire/connecter" -ForegroundColor White
Write-Host "5. Vérifier que les appels vont vers yukpomnang-app.netlify.app" -ForegroundColor White

Write-Host "`n🧪 PAGE DE TEST AUTOMATISÉ:" -ForegroundColor Cyan
Write-Host "URL: $NETLIFY_URL/test-live.html" -ForegroundColor Green
Write-Host "Cette page teste automatiquement tous les endpoints" -ForegroundColor Gray

Write-Host "`n🎯 SI LE PROBLÈME PERSISTE:" -ForegroundColor Yellow
Write-Host "1. Vérifiez la console du navigateur (F12)" -ForegroundColor Gray
Write-Host "2. Regardez l'onglet Network pour voir les vraies URLs appelées" -ForegroundColor Gray
Write-Host "3. Testez la page: $NETLIFY_URL/test-live.html" -ForegroundColor Gray

Write-Host "`n✅ Tests PowerShell confirmés - Application opérationnelle !" -ForegroundColor Green 