# Test de recherche avec le texte exact
Write-Host "Test de recherche avec le texte exact..." -ForegroundColor Green

$body = @{
    query = "Mécanicien Automobile à Esseaka"
    type_donnee = "texte"
    top_k = 20
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Recherche exacte: $($response.results.Count) résultats" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        Write-Host "Résultats trouvés:" -ForegroundColor Cyan
        foreach ($result in $response.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
} 