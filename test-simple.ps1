$backend = "https://yukpomnang.onrender.com"
Write-Host "Test API Yukpomnang" -ForegroundColor Cyan
Write-Host "Backend: $backend" -ForegroundColor Yellow

# Test Health
Write-Host "`nTest Health Check..." -ForegroundColor Green
$response = Invoke-WebRequest -Uri "$backend/healthz" -Method GET
Write-Host "Health: $($response.StatusCode) - $($response.Content)" -ForegroundColor Green

# Test Login
Write-Host "`nTest Login..." -ForegroundColor Green
$body = @{email="test@example.com"; password="test123"} | ConvertTo-Json
$response = Invoke-WebRequest -Uri "$backend/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = ($response.Content | ConvertFrom-Json).token
Write-Host "Login OK - Token: $($token.Substring(0,30))..." -ForegroundColor Green

# Test CORS
Write-Host "`nCORS Headers:" -ForegroundColor Green
Write-Host "Allow-Origin: $($response.Headers['access-control-allow-origin'])" -ForegroundColor Gray
Write-Host "Allow-Methods: $($response.Headers['access-control-allow-methods'])" -ForegroundColor Gray
