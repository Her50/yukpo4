# Vérifier les logs du backend
Write-Host "Vérification des logs du backend..." -ForegroundColor Green

# Test direct du microservice avec le texte traduit
Write-Host "`n1️⃣ Test direct du microservice avec 'car mechanic'..." -ForegroundColor Yellow
$body = '{"query": "car mechanic", "type_donnee": "texte", "top_k": 10}'
$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "Microservice réponse: $($response | ConvertTo-Json)"
    
    if ($response.results -and $response.results.Count -gt 0) {
        Write-Host "✅ Résultats trouvés dans Pinecone!" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️ Aucun résultat dans Pinecone" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
}

# Test avec le texte français pour voir la traduction
Write-Host "`n2️⃣ Test avec 'mécanicien' pour voir la traduction..." -ForegroundColor Yellow
$body2 = '{"query": "mécanicien", "type_donnee": "texte", "top_k": 10}'

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $body2 -ContentType "application/json" -Headers $headers
    Write-Host "Microservice réponse (français): $($response2 | ConvertTo-Json)"
    
    if ($response2.results -and $response2.results.Count -gt 0) {
        Write-Host "✅ Résultats trouvés avec texte français!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Aucun résultat avec texte français" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur microservice (français): $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Analyse:" -ForegroundColor Cyan
Write-Host "Si aucun résultat n'est trouvé, cela peut indiquer:" -ForegroundColor Yellow
Write-Host "1. Les embeddings ne sont pas encore créés" -ForegroundColor Yellow
Write-Host "2. Le seuil de matching est trop élevé" -ForegroundColor Yellow
Write-Host "3. Il y a un problème avec la structure des données" -ForegroundColor Yellow 