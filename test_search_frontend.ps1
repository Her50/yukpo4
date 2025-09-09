# Test de recherche depuis le frontend
Write-Host "Test de recherche frontend..." -ForegroundColor Green

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiaWF0IjoxNzU2NDAwNzE3LCJleHAiOjE3NTY0ODcxMTd9.8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q"
}

$payload = @{
    message = "je cherche un salon de coiffure"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Yellow
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
} 