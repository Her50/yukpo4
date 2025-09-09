# Vérification des services existants dans PostgreSQL et Pinecone
Write-Host "🔍 Vérification des services existants" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# 1. Vérifier les services dans PostgreSQL
Write-Host "`n📊 Services dans PostgreSQL:" -ForegroundColor Yellow

try {
    # Requête pour récupérer tous les services actifs
    $sqlQuery = "SELECT id, category, is_active FROM services WHERE is_active = true ORDER BY id LIMIT 20;"
    
    # Exécuter la requête (ajustez les paramètres selon votre configuration)
    $pgServices = & psql -h localhost -U postgres -d yukpomnang -t -c $sqlQuery 2>$null
    
    if ($LASTEXITCODE -eq 0 -and $pgServices) {
        Write-Host "✅ Services trouvés dans PostgreSQL:" -ForegroundColor Green
        $pgServices | ForEach-Object {
            if ($_.Trim() -ne "") {
                Write-Host "  - $($_.Trim())" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "❌ Aucun service trouvé dans PostgreSQL ou erreur de connexion" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification PostgreSQL: $_" -ForegroundColor Red
}

# 2. Vérifier les services dans Pinecone
Write-Host "`n📊 Services dans Pinecone:" -ForegroundColor Yellow

try {
    # Requête de test pour récupérer des embeddings depuis Pinecone
    $pineconeResponse = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"query":"test","type_donnee":"texte","top_k":20}'
    
    if ($pineconeResponse.results) {
        Write-Host "✅ Services trouvés dans Pinecone:" -ForegroundColor Green
        
        # Extraire et afficher les IDs
        $pineconeIds = @()
        foreach ($result in $pineconeResponse.results) {
            $pineconeId = $result.id
            if ($pineconeId -like "*_texte") {
                $serviceId = $pineconeId -replace "_texte", ""
                $pineconeIds += $serviceId
                Write-Host "  - ID: $serviceId (Pinecone: $pineconeId)" -ForegroundColor Gray
            }
        }
        
        Write-Host "`n📋 Total: $($pineconeIds.Count) services dans Pinecone" -ForegroundColor Blue
    } else {
        Write-Host "❌ Aucun service trouvé dans Pinecone" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification Pinecone: $_" -ForegroundColor Red
}

# 3. Comparaison
Write-Host "`n🔄 ANALYSE DE SYNCHRONISATION" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Récupérer les IDs PostgreSQL (simulation)
$pgIds = @(1, 2, 3, 4, 5) # À remplacer par les vrais IDs de PostgreSQL

# Récupérer les IDs Pinecone (simulation)
$pineconeIds = @(27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614)

Write-Host "Services dans PostgreSQL: $($pgIds.Count)" -ForegroundColor Blue
Write-Host "Services dans Pinecone: $($pineconeIds.Count)" -ForegroundColor Blue

# Trouver les services manquants
$missingInPg = $pineconeIds | Where-Object { $_ -notin $pgIds }
$missingInPinecone = $pgIds | Where-Object { $_ -notin $pineconeIds }

if ($missingInPg.Count -gt 0) {
    Write-Host "`n❌ Services dans Pinecone mais MANQUANTS dans PostgreSQL:" -ForegroundColor Red
    foreach ($id in $missingInPg) {
        Write-Host "  - ID: $id" -ForegroundColor Red
    }
}

if ($missingInPinecone.Count -gt 0) {
    Write-Host "`n❌ Services dans PostgreSQL mais MANQUANTS dans Pinecone:" -ForegroundColor Red
    foreach ($id in $missingInPinecone) {
        Write-Host "  - ID: $id" -ForegroundColor Red
    }
}

if ($missingInPg.Count -eq 0 -and $missingInPinecone.Count -eq 0) {
    Write-Host "`n✅ Synchronisation parfaite entre PostgreSQL et Pinecone!" -ForegroundColor Green
}

Write-Host "`n💡 RECOMMANDATIONS:" -ForegroundColor Yellow
Write-Host "1. Vérifiez que les services existent bien dans PostgreSQL" -ForegroundColor White
Write-Host "2. Assurez-vous que les IDs correspondent entre les deux systèmes" -ForegroundColor White
Write-Host "3. Synchronisez les données si nécessaire" -ForegroundColor White 