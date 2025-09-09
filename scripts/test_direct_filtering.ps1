# Script de test direct du filtrage dans le microservice d'embedding
Write-Host "TEST DIRECT DU FILTRAGE" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$EMBEDDING_API_URL = "http://localhost:8000"

Write-Host "1. Test direct du microservice d'embedding..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
        "x-api-key" = "yukpo_embedding_key_2024"
        "Content-Type" = "application/json"
    } -Body (ConvertTo-Json @{
        query = "Je cherche une librairie"
        type_donnee = "texte"
        top_k = 10
        active = $true
    })

    Write-Host "   ✅ Réponse reçue du microservice" -ForegroundColor Green
    
    # Analyser les résultats
    if ($response.results) {
        Write-Host "`n2. Analyse des résultats du microservice :" -ForegroundColor Yellow
        Write-Host "   - Nombre total de résultats: $($response.results.Count)" -ForegroundColor White
        Write-Host "   - Temps de recherche: $($response.search_time)s" -ForegroundColor White
        
        $services_plomberie = @()
        $services_restaurant = @()
        $services_librairie = @()
        $autres_services = @()
        $services_filtres = @()
        
        foreach ($result in $response.results) {
            $score = $result.score
            $service_id = $result.metadata.service_id
            $type = $result.metadata.type
            
            Write-Host "   Service $service_id ($type) : score=$score" -ForegroundColor White
            
            if ($score -lt 0.70) {
                $services_filtres += @{id=$service_id; score=$score; type=$type}
                Write-Host "     ⚠️  DEVRAIT ÊTRE FILTRÉ (score < 0.70)" -ForegroundColor Red
            } else {
                Write-Host "     ✅ CORRECT (score >= 0.70)" -ForegroundColor Green
            }
            
            # Catégoriser par type (on ne peut pas catégoriser sans les métadonnées complètes)
            if ($type -like "*plomb*") {
                $services_plomberie += @{id=$service_id; score=$score; type=$type}
            } elseif ($type -like "*restaurant*") {
                $services_restaurant += @{id=$service_id; score=$score; type=$type}
            } elseif ($type -like "*librairie*" -or $type -like "*commerce*") {
                $services_librairie += @{id=$service_id; score=$score; type=$type}
            } else {
                $autres_services += @{id=$service_id; score=$score; type=$type}
            }
        }
        
        Write-Host "`n3. Résumé par type :" -ForegroundColor Cyan
        Write-Host "   - Services de plomberie: $($services_plomberie.Count)" -ForegroundColor White
        Write-Host "   - Services de restauration: $($services_restaurant.Count)" -ForegroundColor White
        Write-Host "   - Services de librairie/commerce: $($services_librairie.Count)" -ForegroundColor White
        Write-Host "   - Autres services: $($autres_services.Count)" -ForegroundColor White
        Write-Host "   - Services qui devraient être filtrés: $($services_filtres.Count)" -ForegroundColor Red
        
        if ($services_filtres.Count -gt 0) {
            Write-Host "`n🚨 PROBLÈME : Services avec score < 0.70 qui ne sont pas filtrés !" -ForegroundColor Red
            foreach ($service in $services_filtres) {
                Write-Host "   - Service $($service.id) (score: $($service.score)) - $($service.type)" -ForegroundColor Red
            }
        } else {
            Write-Host "`n✅ SUCCÈS : Tous les services respectent le seuil de 0.70" -ForegroundColor Green
        }
        
    } else {
        Write-Host "   ❌ Pas de résultats dans la réponse" -ForegroundColor Red
    }
    
} catch {
    Write-Host "   ❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Test direct terminé" -ForegroundColor Cyan 