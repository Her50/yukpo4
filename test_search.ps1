# Test de recherche d'embeddings
Write-Host "Test de recherche d'embeddings..." -ForegroundColor Green

$body = @{
    query = "Test embedding"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Recherche réussie: $($response.results.Count) résultats" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        Write-Host "Premier résultat:" -ForegroundColor Cyan
        $response.results[0] | ConvertTo-Json
    }
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
} 