Write-Host "TEST DE PERTINENCE DES RESULTATS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

$EMBEDDING_API_URL = "http://localhost:8000/api/v1"

# Test 1: Restaurant
Write-Host "`n1. TEST RESTAURANT" -ForegroundColor Yellow
try {
    $body = @{
        query = "Je cherche un restaurant"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
        "x-api-key" = "yukpo_embedding_key_2024"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Resultats: $($response.results.Count)" -ForegroundColor Green
    
    foreach ($result in $response.results) {
        $service_id = $result.metadata.service_id
        $score = $result.score
        Write-Host "  Service $service_id - Score: $($score.ToString('F3'))" -ForegroundColor White
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Plombier
Write-Host "`n2. TEST PLOMBIER" -ForegroundColor Yellow
try {
    $body = @{
        query = "Je cherche un plombier"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
        "x-api-key" = "yukpo_embedding_key_2024"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Resultats: $($response.results.Count)" -ForegroundColor Green
    
    foreach ($result in $response.results) {
        $service_id = $result.metadata.service_id
        $score = $result.score
        Write-Host "  Service $service_id - Score: $($score.ToString('F3'))" -ForegroundColor White
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Electricien
Write-Host "`n3. TEST ELECTRICIEN" -ForegroundColor Yellow
try {
    $body = @{
        query = "Je cherche un electricien"
        type_donnee = "texte"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
        "x-api-key" = "yukpo_embedding_key_2024"
        "Content-Type" = "application/json"
    } -Body $body
    
    Write-Host "Resultats: $($response.results.Count)" -ForegroundColor Green
    
    foreach ($result in $response.results) {
        $service_id = $result.metadata.service_id
        $score = $result.score
        Write-Host "  Service $service_id - Score: $($score.ToString('F3'))" -ForegroundColor White
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTEST TERMINE" -ForegroundColor Cyan 