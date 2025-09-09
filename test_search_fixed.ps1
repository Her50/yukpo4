Write-Host "Test de recherche après correction du filtre active" -ForegroundColor Cyan

# Attendre que le microservice redémarre
Write-Host "Attente du redémarrage du microservice..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test direct du microservice avec le filtre active
Write-Host "`n1. Test direct du microservice avec filtre active..." -ForegroundColor Yellow

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
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Microservice fonctionne" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
    
    if ($response.results.Count -gt 0) {
        Write-Host "Premiers résultats:" -ForegroundColor Green
        for ($i = 0; $i -lt [Math]::Min(3, $response.results.Count); $i++) {
            $result = $response.results[$i]
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
}

# Test sans filtre active pour comparaison
Write-Host "`n2. Test sans filtre active pour comparaison..." -ForegroundColor Yellow

$payloadNoFilter = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
} | ConvertTo-Json

try {
    $responseNoFilter = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payloadNoFilter -TimeoutSec 30
    
    Write-Host "✅ Test sans filtre réussi" -ForegroundColor Green
    Write-Host "Nombre de résultats sans filtre: $($responseNoFilter.results.Count)" -ForegroundColor Yellow
    
    if ($response.results.Count -ne $responseNoFilter.results.Count) {
        Write-Host "🎯 Le filtre active fonctionne !" -ForegroundColor Green
        Write-Host "Avec filtre: $($response.results.Count) résultats" -ForegroundColor Green
        Write-Host "Sans filtre: $($responseNoFilter.results.Count) résultats" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Le filtre active ne semble pas avoir d'effet" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur test sans filtre: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Test terminé" -ForegroundColor Green 