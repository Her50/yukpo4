Write-Host "Test de communication Backend - Microservice" -ForegroundColor Cyan

# Test microservice
Write-Host "`n1. Test microservice..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "Microservice OK - Resultats: $($response.results.Count)" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        Write-Host "Premier resultat: $($response.results[0].id)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
}

# Test backend
Write-Host "`n2. Test backend..." -ForegroundColor Yellow

try {
    $backendPayload = @{
        message = "je cherche un pressing"
        user_id = 1
    } | ConvertTo-Json

    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers @{"Content-Type"="application/json"} -Body $backendPayload -TimeoutSec 30
    
    Write-Host "Backend OK - Resultats: $($backendResponse.nombre_matchings)" -ForegroundColor Green
} catch {
    Write-Host "Erreur backend: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest termine" -ForegroundColor Green 