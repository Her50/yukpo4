# Vérification de la synchronisation Pinecone ↔ PostgreSQL
Write-Host "🔍 Vérification de la synchronisation Pinecone ↔ PostgreSQL" -ForegroundColor Cyan

# 1. Récupérer les IDs depuis Pinecone
Write-Host "📡 Récupération des IDs depuis Pinecone..." -ForegroundColor Yellow
$pineconeResponse = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"query":"pressing","type_donnee":"texte","top_k":10}'

Write-Host "✅ Pinecone retourne $($pineconeResponse.results.Count) résultats" -ForegroundColor Green

# 2. Extraire les IDs de service
$serviceIds = @()
foreach ($result in $pineconeResponse.results) {
    $pineconeId = $result.id
    if ($pineconeId -like "*_texte") {
        $serviceId = $pineconeId -replace "_texte", ""
        $serviceIds += $serviceId
        Write-Host "📋 ID extrait: $serviceId (Pinecone ID: $pineconeId)" -ForegroundColor Blue
    }
}

Write-Host "`n🔍 Vérification dans PostgreSQL..." -ForegroundColor Yellow

# 3. Vérifier chaque service dans PostgreSQL
$foundServices = @()
$missingServices = @()

foreach ($serviceId in $serviceIds) {
    Write-Host "🔍 Vérification service ID: $serviceId" -ForegroundColor Gray
    
    # Requête SQL pour vérifier l'existence
    $sqlQuery = "SELECT id, user_id, category, is_active FROM services WHERE id = $serviceId"
    
    try {
        # Utiliser psql pour vérifier (vous devrez ajuster les paramètres de connexion)
        $result = & psql -h localhost -U postgres -d yukpomnang -t -c $sqlQuery 2>$null
        
        if ($result -and $result.Trim() -ne "") {
            Write-Host "✅ Service $serviceId trouvé dans PostgreSQL" -ForegroundColor Green
            $foundServices += $serviceId
        } else {
            Write-Host "❌ Service $serviceId MANQUANT dans PostgreSQL" -ForegroundColor Red
            $missingServices += $serviceId
        }
    } catch {
        Write-Host "❌ Erreur lors de la vérification du service $serviceId" -ForegroundColor Red
        $missingServices += $serviceId
    }
}

# 4. Résumé
Write-Host "`n📊 RÉSUMÉ DE LA SYNCHRONISATION" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Services trouvés dans PostgreSQL: $($foundServices.Count)" -ForegroundColor Green
Write-Host "Services manquants dans PostgreSQL: $($missingServices.Count)" -ForegroundColor Red

if ($missingServices.Count -gt 0) {
    Write-Host "`n❌ Services manquants:" -ForegroundColor Red
    foreach ($id in $missingServices) {
        Write-Host "  - ID: $id" -ForegroundColor Red
    }
    
    Write-Host "`n💡 SOLUTION:" -ForegroundColor Yellow
    Write-Host "Les services existent dans Pinecone mais pas dans PostgreSQL." -ForegroundColor Yellow
    Write-Host "Il faut synchroniser les données entre les deux systèmes." -ForegroundColor Yellow
} else {
    Write-Host "`n✅ Tous les services sont synchronisés !" -ForegroundColor Green
} 