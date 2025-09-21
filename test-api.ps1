#!/usr/bin/env pwsh
# Script de test rapide de l'API Yukpomnang

$backend = "https://yukpomnang.onrender.com"

Write-Host "`n=== Test de l'API Yukpomnang ===" -ForegroundColor Cyan
Write-Host "Backend: $backend" -ForegroundColor Yellow

# Test 1: Health Check
Write-Host "`n[1] Test Health Check..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$backend/healthz" -Method GET
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Health check OK: $($response.Content)" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
}

# Test 2: Login
Write-Host "`n[2] Test Login..." -ForegroundColor Green
$token = $null
try {
    $loginBody = @{
        email = "test@example.com"
        password = "test123"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$backend/auth/login" -Method POST `
        -Body $loginBody -ContentType "application/json"
    
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        $token = $result.token
        Write-Host "✓ Login successful" -ForegroundColor Green
        Write-Host "  Token: $($token.Substring(0, 50))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
}

# Test 3: Protected Route (if login successful)
if ($token) {
    Write-Host "`n[3] Test Protected Route (services/filter)..." -ForegroundColor Green
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Accept" = "application/json"
        }
        
        $response = Invoke-WebRequest -Uri "$backend/services/filter" -Method GET -Headers $headers
        
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Protected route accessible" -ForegroundColor Green
            $services = $response.Content | ConvertFrom-Json
            Write-Host "  Services count: $($services.Count)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "✗ Protected route failed: $_" -ForegroundColor Red
    }
}

# Test 4: CORS Headers
Write-Host "`n[4] Test CORS Headers..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$backend/healthz" -Method GET
    
    $corsHeaders = @{
        "Allow-Origin" = $response.Headers["access-control-allow-origin"]
        "Allow-Methods" = $response.Headers["access-control-allow-methods"]
        "Allow-Headers" = $response.Headers["access-control-allow-headers"]
    }
    
    if ($corsHeaders["Allow-Origin"]) {
        Write-Host "✓ CORS headers present" -ForegroundColor Green
        Write-Host "  Allow-Origin: $($corsHeaders['Allow-Origin'])" -ForegroundColor Gray
        Write-Host "  Allow-Methods: $($corsHeaders['Allow-Methods'])" -ForegroundColor Gray
        Write-Host "  Allow-Headers: $($corsHeaders['Allow-Headers'])" -ForegroundColor Gray
    } else {
        Write-Host "⚠ CORS headers might be missing" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ CORS test failed: $_" -ForegroundColor Red
}

Write-Host "`n=== Test terminé ===" -ForegroundColor Cyan
Write-Host "Pour plus de tests, ouvrez test-connection.html dans un navigateur" -ForegroundColor Yellow 