# Test avec l'ID exact de l'embedding
Write-Host "Test avec l'ID exact de l'embedding..." -ForegroundColor Green

# 1. Créer un embedding avec un ID spécifique
Write-Host "`n1️⃣ Création d'un embedding avec ID spécifique..." -ForegroundColor Yellow

$createRequest = @{
    value = "I am a car mechanic in Esseaka. I offer automobile repair and maintenance services."
    type_donnee = "texte"
    service_id = 777
    langue = "en"
    active = $true
    type_metier = "service"
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $createRequest -ContentType "application/json" -Headers $headers
    Write-Host "✅ Embedding créé avec succès!" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json)"
} catch {
    Write-Host "❌ Erreur création: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Tester la recherche avec l'ID exact
Write-Host "`n2️⃣ Test de recherche avec l'ID exact..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# L'ID devrait être "777_texte" selon le code
$searchRequest = @{
    query = "I am a car mechanic in Esseaka. I offer automobile repair and maintenance services."
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $searchResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
    Write-Host "Recherche résultat: $($searchResponse | ConvertTo-Json)"
    
    if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
        Write-Host "✅ Résultats trouvés!" -ForegroundColor Green
        foreach ($result in $searchResponse.results) {
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Diagnostic:" -ForegroundColor Cyan
Write-Host "Si aucun résultat n'est trouvé même avec le texte exact," -ForegroundColor Yellow
Write-Host "le problème est que l'embedding n'est pas stocké dans Pinecone" -ForegroundColor Red 