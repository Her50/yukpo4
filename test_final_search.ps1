Write-Host "🎯 Test final de la recherche après correction" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# 1. Vérifier que le microservice fonctionne
Write-Host "`n1️⃣ Vérification du microservice..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Microservice fonctionne" -ForegroundColor Green
} catch {
    Write-Host "❌ Microservice non accessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Test de recherche directe avec le microservice
Write-Host "`n2️⃣ Test de recherche directe avec le microservice..." -ForegroundColor Yellow
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
    active = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 10
    
    Write-Host "✅ Recherche microservice réussie" -ForegroundColor Green
    Write-Host "  Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
    
    if ($response.results.Count -gt 0) {
        Write-Host "  Premiers résultats:" -ForegroundColor Green
        for ($i = 0; $i -lt [Math]::Min(3, $response.results.Count); $i++) {
            $result = $response.results[$i]
            Write-Host "    - ID: $($result.id), Score: $($result.score)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Erreur recherche microservice: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Vérifier que le backend est démarré
Write-Host "`n3️⃣ Vérification du backend..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/healthz" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend fonctionne" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Le backend n'est pas démarré ou n'est pas prêt" -ForegroundColor Yellow
    Write-Host "   Vous pouvez le démarrer manuellement avec: cd backend && cargo run" -ForegroundColor Yellow
    exit 1
}

# 4. Test de recherche via l'API backend
Write-Host "`n4️⃣ Test de recherche via l'API backend..." -ForegroundColor Yellow
$searchHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzM1NzI4MDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"
}

$searchPayload = @{
    message = "je cherche un pressing"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $searchHeaders -Body $searchPayload -TimeoutSec 30
    
    Write-Host "✅ Recherche backend réussie !" -ForegroundColor Green
    Write-Host "  Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Yellow
    Write-Host "  Message: $($response.message)" -ForegroundColor Gray
    
    if ($response.resultats -and $response.resultats.Count -gt 0) {
        Write-Host "  Résultats trouvés:" -ForegroundColor Green
        for ($i = 0; $i -lt [Math]::Min(3, $response.resultats.Count); $i++) {
            $result = $response.resultats[$i]
            Write-Host "    - ID: $($result.id), Titre: $($result.titre)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ Aucun résultat trouvé" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur recherche backend: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Test terminé !" -ForegroundColor Green 