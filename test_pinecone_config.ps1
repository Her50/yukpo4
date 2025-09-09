# Test de la configuration Pinecone du microservice
Write-Host "Test de la configuration Pinecone..." -ForegroundColor Green

# Test 1: Vérifier les variables d'environnement
Write-Host "`n1️⃣ Variables d'environnement Pinecone:" -ForegroundColor Yellow
Write-Host "PINECONE_API_KEY: $env:PINECONE_API_KEY" -ForegroundColor Cyan
Write-Host "PINECONE_ENV: $env:PINECONE_ENV" -ForegroundColor Cyan
Write-Host "PINECONE_INDEX: $env:PINECONE_INDEX" -ForegroundColor Cyan

# Test 2: Vérifier si le microservice peut accéder à Pinecone
Write-Host "`n2️⃣ Test de connexion Pinecone via le microservice..." -ForegroundColor Yellow

$testRequest = @{
    query = "test"
    type_donnee = "texte"
    top_k = 1
} | ConvertTo-Json

$headers = @{"x-api-key" = "yukpo_embedding_key_2024"}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/search_embedding_pinecone" -Method POST -Body $testRequest -ContentType "application/json" -Headers $headers
    Write-Host "✅ Microservice répond correctement" -ForegroundColor Green
    Write-Host "Réponse: $($response | ConvertTo-Json)"
} catch {
    Write-Host "❌ Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Vérifier les logs du microservice pour voir s'il y a des erreurs Pinecone
Write-Host "`n3️⃣ Vérification des logs du microservice..." -ForegroundColor Yellow
Write-Host "Regardez les logs du microservice pour voir s'il y a des erreurs Pinecone" -ForegroundColor Cyan
Write-Host "Le problème peut être:" -ForegroundColor Yellow
Write-Host "- Clé API Pinecone invalide" -ForegroundColor Yellow
Write-Host "- Index Pinecone inexistant" -ForegroundColor Yellow
Write-Host "- Problème de connexion réseau" -ForegroundColor Yellow 