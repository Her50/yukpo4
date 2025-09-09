# Script de diagnostic complet du matching semantique
Write-Host "Diagnostic complet du matching semantique" -ForegroundColor Cyan
Write-Host ""

# Configuration des variables d'environnement
$env:EMBEDDING_TIMEOUT_SECONDS="120"
$env:EMBEDDING_MAX_RETRIES="3"
$env:EMBEDDING_RETRY_DELAY_MS="2000"
$env:PINECONE_API_KEY="pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
$env:PINECONE_ENV="us-east-1"
$env:PINECONE_INDEX="service-embeddings"
$env:EMBEDDING_API_URL="http://localhost:8000"
$env:YUKPO_API_KEY="yukpo_embedding_key_2024"

Write-Host "Variables d'environnement configurees" -ForegroundColor Green
Write-Host ""

Write-Host "Etape 1: Verification de la base PostgreSQL..." -ForegroundColor Yellow

try {
    # Compter les services actifs
    $countQuery = "SELECT COUNT(*) as total FROM services WHERE active = true"
    $countResult = psql -h localhost -U postgres -d yukpo_db -t -c $countQuery
    
    if ($countResult -match "(\d+)") {
        $totalServices = $matches[1]
        Write-Host "Services actifs en PostgreSQL: $totalServices" -ForegroundColor Green
    }
    
    # Recuperer quelques exemples de services
    $sampleQuery = "SELECT id, data->>'titre_service' as titre FROM services WHERE active = true LIMIT 5"
    $sampleResult = psql -h localhost -U postgres -d yukpo_db -t -c $sampleQuery
    
    Write-Host "Exemples de services en base:" -ForegroundColor Yellow
    foreach ($line in $sampleResult) {
        if ($line -match "(\d+)\s*\|\s*(.+)") {
            Write-Host "  ID: $($matches[1]) - Titre: $($matches[2])" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "Erreur PostgreSQL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Etape 2: Test de recherche semantique..." -ForegroundColor Yellow

# Headers pour l'API d'embedding
$headers = @{
    "x-api-key" = "yukpo_embedding_key_2024"
    "Content-Type" = "application/json"
}

# Test avec "restaurant"
$testQuery = @{
    "query" = "restaurant"
    "top_k" = 10
    "include_metadata" = $true
} | ConvertTo-Json

try {
    Write-Host "Recherche de 'restaurant'..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $testQuery
    
    if ($response.matches) {
        Write-Host "Resultats trouves: $($response.matches.Count)" -ForegroundColor Green
        Write-Host ""
        
        foreach ($match in $response.matches) {
            $score = [math]::Round($match.score, 4)
            $serviceId = $match.metadata.service_id
            $type = $match.metadata.type
            
            Write-Host "  Score: $score | ID: $serviceId | Type: $type" -ForegroundColor White
            
            # Verifier si le service existe en base
            $existsQuery = "SELECT COUNT(*) FROM services WHERE id = $serviceId AND active = true"
            $existsResult = psql -h localhost -U postgres -d yukpo_db -t -c $existsQuery
            
            if ($existsResult -match "(\d+)") {
                if ($matches[1] -eq "1") {
                    Write-Host "    Existe en base PostgreSQL" -ForegroundColor Green
                } else {
                    Write-Host "    N'existe PAS en base PostgreSQL (FANTÔME!)" -ForegroundColor Red
                }
            }
        }
    }
    
} catch {
    Write-Host "Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Etape 3: Test de creation d'embedding..." -ForegroundColor Yellow

# Test avec un texte simple
$testEmbedding = @{
    "value" = "Restaurant italien"
    "type_donnee" = "texte"
    "service_id" = 999999
    "langue" = "fr"
    "active" = $true
    "type_metier" = "service"
} | ConvertTo-Json

try {
    Write-Host "Test de creation d'embedding pour 'Restaurant italien'..." -ForegroundColor Cyan
    $embedResponse = Invoke-RestMethod -Uri "http://localhost:8000/add_embedding_pinecone" -Method POST -Headers $headers -Body $testEmbedding
    
    Write-Host "Embedding cree: $($embedResponse | ConvertTo-Json)" -ForegroundColor Green
    
    # Nettoyer le test
    $deletePayload = @{
        "service_id" = 999999
    } | ConvertTo-Json
    
    $deleteResponse = Invoke-RestMethod -Uri "http://localhost:8000/delete_embedding_pinecone" -Method POST -Headers $headers -Body $deletePayload
    Write-Host "Test nettoye" -ForegroundColor Yellow
    
} catch {
    Write-Host "Erreur lors du test d'embedding: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Diagnostic termine!" -ForegroundColor Green
Write-Host "Verifiez les resultats ci-dessus pour identifier les problemes." -ForegroundColor White 