# Script pour nettoyer les services orphelins dans Pinecone
# Supprime les embeddings des services qui n'existent plus en PostgreSQL

Write-Host "🧹 NETTOYAGE DES SERVICES ORPHELINS DANS PINECONE" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Token d'authentification
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDYzMywiaWF0IjoxNzU2NTE0MjA5LCJleHAiOjE3NTY2MDA2MDl9.J3aV3GrWgSV_0-GoEqiNVo6i2Ikc76w4e_NKN9JNr6c"

# Services orphelins identifiés dans les logs
$orphanServices = @(
    167820,  # Restaurant Chinois à Bonamoussadi
    921100,  # Recherche restaurant
    531974,  # Recherche plombier (à supprimer)
    862419,  # Recherche plombier (à supprimer)
    279928,  # Restaurant Africain à Kamkop
    4386,    # Recherche électricien
    373989   # Recherche électricien
)

Write-Host "📋 Services orphelins identifiés :" -ForegroundColor Yellow
foreach ($serviceId in $orphanServices) {
    Write-Host "   • Service $serviceId" -ForegroundColor White
}

Write-Host "`n🗑️  Suppression des services orphelins..." -ForegroundColor Yellow

$deletedCount = 0
$errorCount = 0

foreach ($serviceId in $orphanServices) {
    try {
        Write-Host "   Suppression du service $serviceId..." -ForegroundColor White -NoNewline
        
        $response = Invoke-RestMethod -Uri "http://localhost:8000/delete_embedding_pinecone" -Method POST -Headers @{
            "X-API-Key" = "yukpo_embedding_key_2024"
            "Content-Type" = "application/json"
        } -Body (@{
            service_id = $serviceId
        } | ConvertTo-Json)
        
        if ($response.status -eq "deleted") {
            Write-Host " ✅" -ForegroundColor Green
            $deletedCount++
        } else {
            Write-Host " ❌ Erreur: $($response.error)" -ForegroundColor Red
            $errorCount++
        }
        
    } catch {
        Write-Host " ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n📊 RÉSULTATS DU NETTOYAGE :" -ForegroundColor Cyan
Write-Host "   ✅ Services supprimés : $deletedCount" -ForegroundColor Green
Write-Host "   ❌ Erreurs : $errorCount" -ForegroundColor Red

# Test de recherche après nettoyage
Write-Host "`n🧪 Test de recherche après nettoyage..." -ForegroundColor Yellow

try {
    $searchData = @{
        query = "restaurant"
        type_donnee = "texte"
        top_k = 5
        active = $true
    }
    
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers @{
        "X-API-Key" = "yukpo_embedding_key_2024"
        "Content-Type" = "application/json"
    } -Body ($searchData | ConvertTo-Json)
    
    Write-Host "   📊 Résultats trouvés : $($response.results.Count)" -ForegroundColor Green
    
    foreach ($result in $response.results) {
        $serviceId = $result.metadata.service_id
        $score = $result.score
        $category = $result.metadata.type_metier
        Write-Host "      • Service $serviceId : score=$($score.ToString('F3')) - $category" -ForegroundColor White
    }
    
} catch {
    Write-Host "   ❌ Erreur lors du test : $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 NETTOYAGE TERMINÉ !" -ForegroundColor Green
Write-Host "Les services orphelins ont été supprimés de Pinecone." -ForegroundColor White 