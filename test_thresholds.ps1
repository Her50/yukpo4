# Test de différents seuils de matching
Write-Host "Test de différents seuils de matching..." -ForegroundColor Green

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

# Test avec seuil 0.30
Write-Host "`n1. Test avec seuil 0.30..." -ForegroundColor Yellow
$env:MATCHING_SCORE_THRESHOLD = "0.30"

$body = @{
    query = "mécanicien"
    type_donnee = "texte"
    top_k = 20
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Seuil 0.30: $($response.results.Count) résultats" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        foreach ($result in $response.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test avec seuil 0.50
Write-Host "`n2. Test avec seuil 0.50..." -ForegroundColor Yellow
$env:MATCHING_SCORE_THRESHOLD = "0.50"

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Seuil 0.50: $($response.results.Count) résultats" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        foreach ($result in $response.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test avec seuil 0.70 (défaut)
Write-Host "`n3. Test avec seuil 0.70 (défaut)..." -ForegroundColor Yellow
$env:MATCHING_SCORE_THRESHOLD = "0.70"

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Seuil 0.70: $($response.results.Count) résultats" -ForegroundColor Green
    
    if ($response.results.Count -gt 0) {
        foreach ($result in $response.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Remettre le seuil par défaut
$env:MATCHING_SCORE_THRESHOLD = "0.70" 