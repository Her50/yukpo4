# Test de recherche Pinecone
Write-Host "Test de recherche Pinecone..." -ForegroundColor Green

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "mecanicien"
    type_donnee = "texte"
    top_k = 5
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload
    Write-Host "Réponse Pinecone:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Erreur:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} 