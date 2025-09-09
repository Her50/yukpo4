# Créer un service de mécanicien de test
Write-Host "Création d'un service de mécanicien de test..." -ForegroundColor Green

$serviceData = @{
    texte = "Je suis un mécanicien automobile à Esseaka. Je propose des services de réparation et d'entretien automobile. Mon expertise couvre une large gamme de véhicules et je m'assure de fournir un service de qualité pour garantir la satisfaction de mes clients."
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwMzYzMywiaWF0IjoxNzU2NTM1ODE4LCJleHAiOjE3NTY2MjIyMTh9.KJJekiQbgrEFR_78ztLQROfWY-raQLlJPPjjbQOSr3s"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $serviceData -Headers $headers
    Write-Host "Service créé avec succès!" -ForegroundColor Green
    Write-Host "Service ID: $($response.service_id)" -ForegroundColor Cyan
    Write-Host "Réponse: $($response | ConvertTo-Json -Depth 2)"
} catch {
    Write-Host "Erreur création service: $($_.Exception.Message)" -ForegroundColor Red
} 