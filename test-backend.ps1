# Test simple du backend
Write-Host "Test du backend Yukpo..." -ForegroundColor Green

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/ia/auto" -Method POST -ContentType "application/json" -Body '{"texte":"test"}' -TimeoutSec 5
    Write-Host "Backend repond: $($response.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*Missing Authorization header*") {
        Write-Host "Backend fonctionne (auth requise)" -ForegroundColor Green
    } else {
        Write-Host "Erreur backend: $($_.Exception.Message)" -ForegroundColor Red
    }
} 