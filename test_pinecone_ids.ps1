# Test des IDs Pinecone dans PostgreSQL
Write-Host "Test des IDs Pinecone dans PostgreSQL" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Test direct du microservice pour obtenir les IDs
Write-Host "`n1. Récupération des IDs depuis Pinecone..." -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 10
    active = $true
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Réponse Pinecone reçue" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
    
    # Extraire les IDs numériques
    $service_ids = @()
    foreach ($result in $response.results) {
        $pinecone_id = $result.id
        $score = $result.score
        
        # Extraire l'ID numérique (partie avant le underscore)
        if ($pinecone_id -match "^(\d+)_") {
            $numeric_id = $matches[1]
            $service_ids += $numeric_id
            Write-Host "ID Pinecone: $pinecone_id -> ID numérique: $numeric_id (score: $score)" -ForegroundColor Gray
        }
    }
    
    Write-Host "`n2. Vérification des services dans PostgreSQL..." -ForegroundColor Cyan
    
    # Test avec l'API du backend pour vérifier chaque service
    $backend_headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxNzY3NSwiaWF0IjoxNzU2MzgzNzA4LCJleHAiOjE3NTY0NzAxMDh9.cPDj7U1_b0nkMYqNQ-txKa5sigTK_-eDUq9YIVVpSx0"
    }
    
    foreach ($service_id in $service_ids) {
        Write-Host "`nVérification du service ID: $service_id" -ForegroundColor Yellow
        
        try {
            $service_response = Invoke-RestMethod -Uri "http://localhost:3001/api/services/$service_id" -Method GET -Headers $backend_headers -TimeoutSec 10
            Write-Host "✅ Service $service_id trouvé dans PostgreSQL" -ForegroundColor Green
            Write-Host "   Titre: $($service_response.titre)" -ForegroundColor Gray
            Write-Host "   Catégorie: $($service_response.category)" -ForegroundColor Gray
            Write-Host "   Actif: $($service_response.is_active)" -ForegroundColor Gray
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "❌ Service $service_id NON trouvé (HTTP $statusCode)" -ForegroundColor Red
            
            if ($statusCode -eq 404) {
                Write-Host "   → Le service n'existe pas dans PostgreSQL" -ForegroundColor Red
            } else {
                Write-Host "   → Erreur: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "`n3. Résumé..." -ForegroundColor Cyan
    Write-Host "IDs trouvés dans Pinecone: $($service_ids.Count)" -ForegroundColor Yellow
    Write-Host "Services à vérifier: $($service_ids -join ', ')" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
} 