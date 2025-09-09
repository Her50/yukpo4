# Test avec un seuil de matching plus bas
Write-Host "Test avec seuil de matching bas..." -ForegroundColor Green

# 1. Créer un embedding de test
Write-Host "`n1️⃣ Création d'un embedding de test..." -ForegroundColor Yellow

$createRequest = @{
    value = "I am a car mechanic in Esseaka. I offer automobile repair and maintenance services."
    type_donnee = "texte"
    service_id = 888
    langue = "en"
    active = $true
    type_metier = "service"
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/add_embedding_pinecone" -Method POST -Body $createRequest -ContentType "application/json" -Headers $headers
    Write-Host "✅ Embedding créé avec succès!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur création: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Tester la recherche avec différents seuils
Write-Host "`n2️⃣ Test de recherche avec différents seuils..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$searchTerms = @("car mechanic", "automobile repair", "mechanic", "car", "repair")

foreach ($term in $searchTerms) {
    Write-Host "`nTest avec: '$term'" -ForegroundColor Cyan
    
    $searchRequest = @{
        query = $term
        type_donnee = "texte"
        top_k = 10
    } | ConvertTo-Json
    
    try {
        $searchResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $searchRequest -ContentType "application/json" -Headers $headers
        
        if ($searchResponse.results -and $searchResponse.results.Count -gt 0) {
            Write-Host "✅ Trouvé $($searchResponse.results.Count) résultats avec '$term'" -ForegroundColor Green
            foreach ($result in $searchResponse.results) {
                Write-Host "  - Score: $($result.score), ID: $($result.id)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "❌ Aucun résultat avec '$term'" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Analyse:" -ForegroundColor Cyan
Write-Host "Si aucun résultat n'est trouvé même avec des termes simples," -ForegroundColor Yellow
Write-Host "le problème peut être:" -ForegroundColor Yellow
Write-Host "1. Le seuil de matching est encore trop élevé" -ForegroundColor Yellow
Write-Host "2. L'ID de l'embedding ne correspond pas" -ForegroundColor Yellow
Write-Host "3. Il y a un problème avec les métadonnées" -ForegroundColor Yellow 