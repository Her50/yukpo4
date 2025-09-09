# Test du backend avec l'embedding existant
Write-Host "Test du backend avec l'embedding existant..." -ForegroundColor Green

$body = @{
    texte = "Mécanicien Automobile à Esseaka"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwMzYzMywiaWF0IjoxNzU2NTM1ODE4LCJleHAiOjE3NTY2MjIyMTh9.KJJekiQbgrEFR_78ztLQROfWY-raQLlJPPjjbQOSr3s"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $body -Headers $headers
    Write-Host "Backend OK" -ForegroundColor Green
    
    if ($response.resultats) {
        Write-Host "Resultats: $($response.resultats | ConvertTo-Json)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Backend ERROR: $($_.Exception.Message)" -ForegroundColor Red
} 