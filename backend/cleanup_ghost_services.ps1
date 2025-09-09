# Script de nettoyage des services fantômes de Pinecone
Write-Host "🧹 Nettoyage des services fantômes de Pinecone" -ForegroundColor Cyan
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

Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Étape 1: Récupération de tous les services depuis PostgreSQL..." -ForegroundColor Yellow
$pgServices = @()

try {
    # Récupérer tous les IDs de services depuis PostgreSQL
    $query = "SELECT id FROM services WHERE active = true ORDER BY id"
    $pgResult = psql -h localhost -U postgres -d yukpo_db -t -c $query
    
    foreach ($line in $pgResult) {
        if ($line -match "(\d+)") {
            $pgServices += $matches[1]
        }
    }
    
    Write-Host "✅ Services PostgreSQL trouvés: $($pgServices.Count)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur PostgreSQL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Étape 2: Vérification des services dans Pinecone..." -ForegroundColor Yellow

# Headers pour l'API d'embedding
$headers = @{
    "x-api-key" = "yukpo_embedding_key_2024"
    "Content-Type" = "application/json"
}

# Récupérer la liste des services depuis Pinecone
$pineconeQuery = @{
    "query" = "restaurant"
    "top_k" = 1000
    "include_metadata" = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $pineconeQuery
    
    if ($response.matches) {
        Write-Host "✅ Services Pinecone trouvés: $($response.matches.Count)" -ForegroundColor Green
        
        $ghostServices = @()
        $validServices = @()
        
        foreach ($match in $response.matches) {
            $serviceId = $match.metadata.service_id
            if ($pgServices -contains $serviceId) {
                $validServices += $serviceId
            } else {
                $ghostServices += $serviceId
            }
        }
        
        Write-Host ""
        Write-Host "📊 Statistiques:" -ForegroundColor Yellow
        Write-Host "  • Services valides: $($validServices.Count)" -ForegroundColor Green
        Write-Host "  • Services fantômes: $($ghostServices.Count)" -ForegroundColor Red
        
        if ($ghostServices.Count -gt 0) {
            Write-Host ""
            Write-Host "🚨 Services fantômes détectés:" -ForegroundColor Red
            $ghostServices | ForEach-Object { Write-Host "  - ID: $_" -ForegroundColor Red }
            
            Write-Host ""
            Write-Host "🧹 Nettoyage des services fantômes..." -ForegroundColor Yellow
            
            foreach ($ghostId in $ghostServices) {
                $deletePayload = @{
                    "service_id" = $ghostId
                } | ConvertTo-Json
                
                try {
                    $deleteResponse = Invoke-RestMethod -Uri "http://localhost:8000/delete_embedding_pinecone" -Method POST -Headers $headers -Body $deletePayload
                    Write-Host "✅ Service fantôme $ghostId supprimé" -ForegroundColor Green
                } catch {
                    Write-Host "❌ Erreur suppression service $ghostId : $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        }
    }
    
} catch {
    Write-Host "❌ Erreur lors de la vérification Pinecone: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 Nettoyage terminé!" -ForegroundColor Green
Write-Host "Maintenant les scores devraient être plus cohérents." -ForegroundColor White 