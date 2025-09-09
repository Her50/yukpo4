# Test direct de la base de données PostgreSQL
Write-Host "Test direct de la base de données PostgreSQL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

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
    
    Write-Host "`n2. Test direct de la base de données..." -ForegroundColor Cyan
    Write-Host "IDs à vérifier: $($service_ids -join ', ')" -ForegroundColor Yellow
    
    # Test avec psql si disponible
    Write-Host "`n3. Vérification avec psql..." -ForegroundColor Cyan
    
    foreach ($service_id in $service_ids) {
        Write-Host "`nVérification du service ID: $service_id" -ForegroundColor Yellow
        
        # Requête SQL pour vérifier si le service existe
        $sql_query = "SELECT id, user_id, category, is_active, created_at FROM services WHERE id = $service_id;"
        
        try {
            # Utiliser psql si disponible
            $result = & psql -h localhost -U postgres -d yukpomnang -c $sql_query 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Service $service_id trouvé dans PostgreSQL" -ForegroundColor Green
                Write-Host "   Résultat: $result" -ForegroundColor Gray
            } else {
                Write-Host "❌ Service $service_id NON trouvé dans PostgreSQL" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Erreur psql: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "   → psql non disponible ou erreur de connexion" -ForegroundColor Gray
        }
    }
    
    Write-Host "`n4. Résumé..." -ForegroundColor Cyan
    Write-Host "IDs trouvés dans Pinecone: $($service_ids.Count)" -ForegroundColor Yellow
    Write-Host "Services à vérifier: $($service_ids -join ', ')" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
} 