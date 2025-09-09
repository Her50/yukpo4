# Test de recherche générique
Write-Host "Test de recherche générique..." -ForegroundColor Green

$body = @{
    query = "mécanicien"
    type_donnee = "texte"
    top_k = 20
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Recherche 'mécanicien': $($response.results.Count) résultats" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        Write-Host "Résultats trouvés:" -ForegroundColor Cyan
        foreach ($result in $response.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
} 