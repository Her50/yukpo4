# Création du service de pressing manquant
Write-Host "Creation du service de pressing" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxODAwMCwiaWF0IjoxNzU2MzgyOTk2LCJleHAiOjE3NTY0NjkzOTZ9.3z2QKy4AuuxU2p1Sp5iOe7zHX7nISsY0mxEfGSLQ8M8"
}

$payload = @{
    titre_service = "Pressing à Douala"
    category = "Services de nettoyage"
    description = "Service de pressing offrant nettoyage et repassage de vêtements à Douala. Service professionnel et rapide."
    prix = "5000 FCFA"
    localisation = "Douala, Cameroun"
    is_tarissable = $false
} | ConvertTo-Json -Depth 10

Write-Host "Creation du service de pressing..." -ForegroundColor Yellow
Write-Host "Payload: $payload" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/services" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    Write-Host "Service cree avec succes!" -ForegroundColor Green
    Write-Host "ID du service: $($response.id)" -ForegroundColor Cyan
    Write-Host "Titre: $($response.titre)" -ForegroundColor Cyan
    Write-Host "Category: $($response.category)" -ForegroundColor Cyan
} catch {
    Write-Host "Erreur lors de la creation du service: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Details de l'erreur: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`nTest termine!" -ForegroundColor Green 