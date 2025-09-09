Write-Host "Test avec authentification JWT" -ForegroundColor Cyan

# 1. Login pour obtenir un token
Write-Host "`n1. Login pour obtenir un token..." -ForegroundColor Yellow

$loginPayload = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginPayload -TimeoutSec 30
    
    $token = $loginResponse.token
    Write-Host "Token obtenu: $($token.Substring(0, 20))..." -ForegroundColor Green
} catch {
    Write-Host "Erreur login: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Tentative avec token par defaut..." -ForegroundColor Yellow
    
    # Token par défaut pour les tests
    $token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzM1NzI4MDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"
}

# 2. Test backend avec token
Write-Host "`n2. Test backend avec token..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

$backendPayload = @{
    message = "je cherche un pressing"
    user_id = 1
} | ConvertTo-Json

try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $backendPayload -TimeoutSec 30
    
    Write-Host "Backend OK - Resultats: $($backendResponse.nombre_matchings)" -ForegroundColor Green
    
    if ($backendResponse.resultats -and $backendResponse.resultats.Count -gt 0) {
        Write-Host "Premier service: $($backendResponse.resultats[0].titre)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Erreur backend: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest termine" -ForegroundColor Green 