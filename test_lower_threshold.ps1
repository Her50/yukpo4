# Test avec seuil de matching plus bas
Write-Host "Test avec seuil de matching plus bas..." -ForegroundColor Green

# Modifier temporairement le seuil dans le microservice
$env:MATCHING_SCORE_THRESHOLD = "0.30"

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "mecanicien"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload
    Write-Host "Résultats avec seuil 0.30: $($response.results.Count)" -ForegroundColor Green
    if ($response.results.Count -gt 0) {
        foreach ($result in $response.results) {
            Write-Host "ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Remettre le seuil par défaut
$env:MATCHING_SCORE_THRESHOLD = "0.70" 