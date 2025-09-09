# Test de recherche améliorée avec nouveaux seuils
Write-Host "Test de recherche améliorée..." -ForegroundColor Green

Start-Sleep -Seconds 20

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNTc0MywiaWF0IjoxNzU2NDAxMzY2LCJleHAiOjE3NTY0ODc3NjZ9.l2RuerOvMZux5vq1PRYqf50_F3yY7HiQf68NfhcnAvg"
}

$payload = @{
    message = "je cherche où trouver une glace italienne"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Yellow
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
} 