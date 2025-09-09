Write-Host "Simulation exacte de la requête backend" -ForegroundColor Cyan

# Simuler exactement la requête que le backend envoie
Write-Host "`n1. Simulation de la requête backend..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

# Requête exacte que le backend envoie (d'après le code)
$backendRequest = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
    gps_lat = $null
    gps_lon = $null
    gps_radius_km = $null
    active = $true
} | ConvertTo-Json

Write-Host "Requête envoyée: $backendRequest" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $backendRequest -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
    
    if ($response.results.Count -gt 0) {
        Write-Host "Premiers résultats:" -ForegroundColor Green
        for ($i = 0; $i -lt [Math]::Min(3, $response.results.Count); $i++) {
            $result = $response.results[$i]
            Write-Host "  - ID: $($result.id), Score: $($result.score)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

# Test avec une requête plus simple
Write-Host "`n2. Test avec requête simplifiée..." -ForegroundColor Yellow

$simpleRequest = @{
    query = "pressing"
    type_donnee = "texte"
    top_k = 5
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $simpleRequest -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response2.results.Count)" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Simulation terminée" -ForegroundColor Green 