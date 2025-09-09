Write-Host "Testing Pinecone services with correct API key..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers @{"Content-Type"="application/json"; "x-api-key"="yukpo_embedding_key_2024"} -Body '{"query":"test","type_donnee":"texte","top_k":10}'
    
    Write-Host "Pinecone response received"
    Write-Host "Number of results: $($response.results.Count)"
    
    Write-Host "`nServices found in Pinecone:"
    foreach ($result in $response.results) {
        $id = $result.id
        $score = $result.score
        Write-Host "  - ID: $id, Score: $score"
    }
    
    # Vérifier les IDs spécifiques des logs
    $logIds = @(27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614)
    Write-Host "`nChecking specific IDs from logs:"
    
    foreach ($logId in $logIds) {
        $found = $false
        foreach ($result in $response.results) {
            $pineconeId = $result.id
            if ($pineconeId -eq "$logId`_texte") {
                Write-Host "  ✅ ID $logId found in Pinecone (score: $($result.score))"
                $found = $true
                break
            }
        }
        if (-not $found) {
            Write-Host "  ❌ ID $logId NOT found in Pinecone"
        }
    }
    
} catch {
    Write-Host "Error: $_"
} 