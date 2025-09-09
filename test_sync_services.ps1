# Test de synchronisation entre Pinecone et PostgreSQL
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
        Write-Host "  - Pinecone ID: $pineconeId → Service ID: $serviceId" -ForegroundColor Gray
    }
}

Write-Host "📋 IDs de services à vérifier: $($serviceIds -join ', ')" -ForegroundColor Yellow

# 3. Vérifier chaque service dans PostgreSQL
Write-Host "`n🗄️ Vérification dans PostgreSQL..." -ForegroundColor Yellow

$missingServices = @()
$existingServices = @()

foreach ($serviceId in $serviceIds) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/services/$serviceId" -Method GET -Headers @{"Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzM1NzI4MDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"} -ErrorAction Stop
        $existingServices += $serviceId
        Write-Host "  ✅ Service $serviceId existe dans PostgreSQL" -ForegroundColor Green
    }
    catch {
        $missingServices += $serviceId
        Write-Host "  ❌ Service $serviceId MANQUANT dans PostgreSQL" -ForegroundColor Red
    }
}

# 4. Résumé
Write-Host "`n📊 RÉSUMÉ:" -ForegroundColor Cyan
Write-Host "  - Services dans Pinecone: $($serviceIds.Count)" -ForegroundColor White
Write-Host "  - Services dans PostgreSQL: $($existingServices.Count)" -ForegroundColor Green
Write-Host "  - Services manquants: $($missingServices.Count)" -ForegroundColor Red

if ($missingServices.Count -gt 0) {
    Write-Host "`n🔧 Services manquants: $($missingServices -join ', ')" -ForegroundColor Red
    
    # 5. Créer un service de test
    Write-Host "`n🛠️ Création d'un service de test (280093)..." -ForegroundColor Yellow
    
    $testService = @{
        user_id = 1
        data = @{
            titre = @{
                type_donnee = "string"
                valeur = "Pressing à Douala"
                origine_champs = "texte_libre"
            }
            description = @{
                type_donnee = "string"
                valeur = "Service de pressing offrant nettoyage et repassage de vêtements à Douala."
                origine_champs = "texte_libre"
            }
            prix = @{
                type_donnee = "string"
                valeur = "5000 FCFA"
                origine_champs = "texte_libre"
            }
        }
        category = "Services de nettoyage"
        gps = "Douala, Cameroun"
        is_active = $true
    }
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/services" -Method POST -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzM1NzI4MDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"} -Body ($testService | ConvertTo-Json -Depth 10) -ErrorAction Stop
        Write-Host "  ✅ Service de test créé avec succès" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Erreur lors de la création du service de test: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n✅ Test terminé" -ForegroundColor Green 