# Script de test pour l'endpoint météo
Write-Host "=== Test de l'endpoint météo ===" -ForegroundColor Green

# URL de votre backend (ajustez selon votre configuration)
$backendUrl = "http://localhost:3000"

Write-Host "1. Test de l'endpoint de configuration météo..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$backendUrl/api/weather/config" -Method GET
    Write-Host "✅ Endpoint config accessible" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
    
    if ($response.apiKey -and $response.apiKey -ne "YOUR_OPENWEATHER_API_KEY") {
        Write-Host "✅ Clé API récupérée avec succès" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Clé API non configurée ou par défaut" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Erreur endpoint config: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2. Test de l'endpoint météo avec coordonnées Yaoundé..." -ForegroundColor Yellow
try {
    $weatherParams = @{
        lat   = 3.848
        lon   = 11.502
        units = "metric"
        lang  = "fr"
    }
    
    $queryString = ($weatherParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
    $weatherUrl = "$backendUrl/api/weather?$queryString"
    
    $weatherResponse = Invoke-RestMethod -Uri $weatherUrl -Method GET
    Write-Host "✅ Endpoint météo accessible" -ForegroundColor Green
    Write-Host "Température: $($weatherResponse.main.temp)°C" -ForegroundColor Cyan
    Write-Host "Description: $($weatherResponse.weather[0].description)" -ForegroundColor Cyan
    Write-Host "Ville: $($weatherResponse.name)" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Erreur endpoint météo: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test terminé ===" -ForegroundColor Green

