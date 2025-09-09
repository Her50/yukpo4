# Test de recherche avec des termes simples
Write-Host "Test de recherche avec des termes simples..." -ForegroundColor Green

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

# Test 1: Terme très simple
$payload1 = @{
    query = "automobile"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

Write-Host "`nTest 1: Recherche 'automobile'" -ForegroundColor Yellow
try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload1
    Write-Host "Résultats: $($response1.results.Count)" -ForegroundColor Green
    if ($response1.results.Count -gt 0) {
        foreach ($result in $response1.results) {
            Write-Host "ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Terme en anglais
$payload2 = @{
    query = "car"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

Write-Host "`nTest 2: Recherche 'car'" -ForegroundColor Yellow
try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload2
    Write-Host "Résultats: $($response2.results.Count)" -ForegroundColor Green
    if ($response2.results.Count -gt 0) {
        foreach ($result in $response2.results) {
            Write-Host "ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
} 