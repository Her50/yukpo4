# Test direct de Pinecone pour voir s'il y a des embeddings
Write-Host "Test direct de Pinecone..." -ForegroundColor Green

# Test avec différents termes pour voir s'il y a des embeddings
$terms = @("car", "mechanic", "automobile", "repair", "service")

foreach ($term in $terms) {
    Write-Host "`nTest avec: '$term'" -ForegroundColor Yellow
    
    $body = @{
        query = $term
        type_donnee = "texte"
        top_k = 5
    } | ConvertTo-Json
    
    $headers = @{"x-api-key" = "yukpo_embedding_key_2024"}
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
        
        if ($response.results -and $response.results.Count -gt 0) {
            Write-Host "✅ Trouvé $($response.results.Count) résultats avec '$term'" -ForegroundColor Green
            foreach ($result in $response.results) {
                Write-Host "  - Score: $($result.score), Service ID: $($result.metadata.service_id)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "❌ Aucun résultat avec '$term'" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur avec '$term': $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Conclusion:" -ForegroundColor Cyan
Write-Host "Si aucun résultat n'est trouvé avec aucun terme, cela signifie:" -ForegroundColor Yellow
Write-Host "1. Aucun embedding n'est stocké dans Pinecone" -ForegroundColor Yellow
Write-Host "2. Il y a un problème avec la création/storage des embeddings" -ForegroundColor Yellow
Write-Host "3. Le service de création d'embeddings ne fonctionne pas" -ForegroundColor Yellow 