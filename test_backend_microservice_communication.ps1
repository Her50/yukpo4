# Test de communication entre Backend et Microservice
Write-Host "🔍 Test de communication Backend ↔ Microservice" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# 1. Test direct du microservice (comme le backend le fait)
Write-Host "`n1️⃣ Test direct du microservice..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Microservice répond correctement" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
    
    if ($response.results.Count -gt 0) {
        Write-Host "`n📋 Résultats trouvés:" -ForegroundColor Green
        foreach ($result in $response.results) {
            $id = $result.id
            $score = $result.score
            Write-Host "  - ID: $id, Score: $score" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Test de l'API backend (si disponible)
Write-Host "`n2️⃣ Test de l'API backend..." -ForegroundColor Yellow

try {
    $backendPayload = @{
        message = "je cherche un pressing"
        user_id = 1
    } | ConvertTo-Json -Depth 10

    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers @{"Content-Type"="application/json"} -Body $backendPayload -TimeoutSec 30
    
    Write-Host "✅ Backend répond correctement" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($backendResponse.nombre_matchings)" -ForegroundColor Yellow
    
    if ($backendResponse.resultats -and $backendResponse.resultats.Count -gt 0) {
        Write-Host "`n📋 Résultats backend:" -ForegroundColor Green
        foreach ($result in $backendResponse.resultats) {
            Write-Host "  - Service: $($result.titre)" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Aucun résultat dans la réponse backend" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur backend: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Comparaison des réponses
Write-Host "`n3️⃣ Analyse de la différence..." -ForegroundColor Yellow

Write-Host "Microservice trouve: $($response.results.Count) résultats" -ForegroundColor Blue
Write-Host "Backend trouve: $($backendResponse.nombre_matchings) résultats" -ForegroundColor Blue

if ($response.results.Count -gt 0 -and $backendResponse.nombre_matchings -eq 0) {
    Write-Host "`n🔍 PROBLÈME IDENTIFIÉ:" -ForegroundColor Red
    Write-Host "Le microservice trouve des résultats mais le backend n'en trouve aucun." -ForegroundColor Red
    Write-Host "Cela indique un problème dans la communication entre les deux services." -ForegroundColor Red
}

Write-Host "`n✅ Test terminé" -ForegroundColor Green 