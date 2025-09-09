Write-Host "Testing Pinecone services with API key..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers @{"Content-Type"="application/json"; "x-api-key"="yukpo_embedding_key"} -Body '{"query":"test","type_donnee":"texte","top_k":10}'
    
    Write-Host "Pinecone response received"
    Write-Host "Number of results: $($response.results.Count)"
    
    foreach ($result in $response.results) {
        $id = $result.id
        $score = $result.score
        Write-Host "ID: $id, Score: $score"
    }
} catch {
    Write-Host "Error: $_"
} 