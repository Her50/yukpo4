# Test final avec seuil réduit
Write-Host "Test final avec seuil réduit..." -ForegroundColor Green

$searchRequest = @{
    query = "car mechanic"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
    Write-Host "Résultat: $($response | ConvertTo-Json)"
    
    if ($response.results -and $response.results.Count -gt 0) {
        Write-Host "🎉 SUCCÈS: Résultats trouvés!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
} 