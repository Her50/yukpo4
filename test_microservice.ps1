# Test du microservice d'embedding
Write-Host "Test du microservice d'embedding..." -ForegroundColor Green

$body = '{"query": "car mechanic", "type_donnee": "texte", "top_k": 5}'
$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Microservice OK" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json)"
} catch {
    Write-Host "Microservice ERROR: $($_.Exception.Message)" -ForegroundColor Red
} 