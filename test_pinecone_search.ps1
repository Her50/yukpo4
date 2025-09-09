# Test de recherche Pinecone
Write-Host "Test de recherche Pinecone..." -ForegroundColor Green

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "salon de coiffure"
    type_donnee = "texte"
    top_k = 5
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Yellow
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
} 