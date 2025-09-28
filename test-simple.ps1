# Test simple de connectivité backend
Write-Host "Test de connectivité backend Yukpomnang" -ForegroundColor Yellow

$backendUrl = "https://yukpomnang.onrender.com"

try {
    Write-Host "Test de la route racine..." -ForegroundColor Cyan
    $response = Invoke-WebRequest -Uri "$backendUrl/" -Method GET -TimeoutSec 15
    Write-Host "SUCCESS: Backend accessible! Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Reponse: $($response.Content)" -ForegroundColor Gray
    
    Write-Host "`nTest de l'API health..." -ForegroundColor Cyan
    $healthResponse = Invoke-WebRequest -Uri "$backendUrl/api/health" -Method GET -TimeoutSec 10
    Write-Host "SUCCESS: API Health accessible! Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Reponse: $($healthResponse.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Le backend est peut-etre en cours de deploiement..." -ForegroundColor Yellow
}