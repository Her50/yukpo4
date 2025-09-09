# Script de diagnostic simple du matching semantique
Write-Host "Diagnostic du matching semantique" -ForegroundColor Cyan
Write-Host ""

# Configuration des variables d'environnement
$env:EMBEDDING_TIMEOUT_SECONDS="120"
$env:PINECONE_API_KEY="pcsk_6aD9si_CSCQPpYjfbVR5VKmqaZQYDu2P49KsvSBvbgUftR24tRMYp7YesZfNWDrALRhdmu"
$env:PINECONE_ENV="us-east-1"
$env:PINECONE_INDEX="service-embeddings"
$env:EMBEDDING_API_URL="http://localhost:8000"
$env:YUKPO_API_KEY="yukpo_embedding_key_2024"

Write-Host "Variables configurees" -ForegroundColor Green
Write-Host ""

Write-Host "Etape 1: Verification PostgreSQL..." -ForegroundColor Yellow

try {
    $countQuery = "SELECT COUNT(*) FROM services WHERE active = true"
    $countResult = psql -h localhost -U postgres -d yukpo_db -t -c $countQuery
    
    if ($countResult -match "(\d+)") {
        $totalServices = $matches[1]
        Write-Host "Services actifs: $totalServices" -ForegroundColor Green
    }
    
    $sampleQuery = "SELECT id, data->>'titre_service' as titre FROM services WHERE active = true LIMIT 3"
    $sampleResult = psql -h localhost -U postgres -d yukpo_db -t -c $sampleQuery
    
    Write-Host "Exemples de services:" -ForegroundColor Yellow
    foreach ($line in $sampleResult) {
        if ($line -match "(\d+)\s*\|\s*(.+)") {
            Write-Host "  ID: $($matches[1]) - $($matches[2])" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "Erreur PostgreSQL" -ForegroundColor Red
}

Write-Host ""
Write-Host "Etape 2: Test recherche semantique..." -ForegroundColor Yellow

$headers = @{
    "x-api-key" = "yukpo_embedding_key_2024"
    "Content-Type" = "application/json"
}

$testQuery = @{
    "query" = "restaurant"
    "top_k" = 5
    "include_metadata" = $true
} | ConvertTo-Json

try {
    Write-Host "Recherche 'restaurant'..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $testQuery
    
    if ($response.matches) {
        Write-Host "Resultats: $($response.matches.Count)" -ForegroundColor Green
        
        foreach ($match in $response.matches) {
            $score = [math]::Round($match.score, 4)
            $serviceId = $match.metadata.service_id
            
            Write-Host "  Score: $score | ID: $serviceId" -ForegroundColor White
            
            $existsQuery = "SELECT COUNT(*) FROM services WHERE id = $serviceId AND active = true"
            $existsResult = psql -h localhost -U postgres -d yukpo_db -t -c $existsQuery
            
            if ($existsResult -match "(\d+)") {
                if ($matches[1] -eq "1") {
                    Write-Host "    Existe en base" -ForegroundColor Green
                } else {
                    Write-Host "    FANTÔME!" -ForegroundColor Red
                }
            }
        }
    }
    
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Diagnostic termine!" -ForegroundColor Green 