# Vérification simple des services existants
Write-Host "🔍 Vérification des services existants" -ForegroundColor Cyan

# 1. Vérifier les services dans Pinecone
Write-Host "`n📊 Services dans Pinecone:" -ForegroundColor Yellow

try {
    $pineconeResponse = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"query":"test","type_donnee":"texte","top_k":20}'
    
    if ($pineconeResponse.results) {
        Write-Host "✅ Services trouvés dans Pinecone:" -ForegroundColor Green
        
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
        
        # Afficher les IDs spécifiques des logs
        $logIds = @(27437, 228231, 280093, 697714, 681447, 531974, 235094, 773325, 859203, 559614)
        Write-Host "`n🔍 Vérification des IDs des logs:" -ForegroundColor Yellow
        
        foreach ($logId in $logIds) {
            if ($logId -in $pineconeIds) {
                Write-Host "  ✅ ID $logId trouvé dans Pinecone" -ForegroundColor Green
            } else {
                Write-Host "  ❌ ID $logId MANQUANT dans Pinecone" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "❌ Aucun service trouvé dans Pinecone" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification Pinecone: $_" -ForegroundColor Red
}

Write-Host "`n💡 RECOMMANDATIONS:" -ForegroundColor Yellow
Write-Host "1. Vérifiez que le microservice Pinecone fonctionne" -ForegroundColor White
Write-Host "2. Exécutez le script SQL check_postgres_services.sql pour vérifier PostgreSQL" -ForegroundColor White
Write-Host "3. Comparez les IDs entre les deux systèmes" -ForegroundColor White 