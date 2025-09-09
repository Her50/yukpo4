# Script pour diagnostiquer le problème de filtrage
Write-Host "DIAGNOSTIC DU FILTRAGE" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"

Write-Host "1. Test de recherche 'librairie'..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
        "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDQxMiwiaWF0IjoxNzU2NTE2MTY2LCJleHAiOjE3NTY2MDI1NjZ9.KqaQQb-UmDyZ1Y7SGMXCaukCxLF9QDqRodVBaPQWUII"
        "Content-Type" = "application/json"
    } -Body (ConvertTo-Json @{
        message = "Je cherche une librairie"
        user_id = 1
    })

    Write-Host "   ✅ Réponse reçue" -ForegroundColor Green
    
    # Analyser les résultats
    if ($response.resultats -and $response.resultats.results) {
        Write-Host "`n2. Analyse détaillée des résultats :" -ForegroundColor Yellow
        Write-Host "   - Nombre total de résultats: $($response.resultats.results.Count)" -ForegroundColor White
        Write-Host "   - Seuil appliqué: $($response.threshold_applied)" -ForegroundColor White
        
        $services_plomberie = @()
        $services_restaurant = @()
        $services_librairie = @()
        $autres_services = @()
        $services_filtres = @()
        
        foreach ($result in $response.resultats.results) {
            $score = $result.score
            $service_id = $result.metadata.service_id
            $category = $result.metadata.ia_response | ConvertFrom-Json | Select-Object -ExpandProperty category
            
            Write-Host "   Service $service_id : score=$score - $($category.valeur)" -ForegroundColor White
            
            if ($score -lt 0.70) {
                $services_filtres += @{id=$service_id; score=$score; category=$category.valeur}
                Write-Host "     ⚠️  DEVRAIT ÊTRE FILTRÉ (score < 0.70)" -ForegroundColor Red
            } else {
                Write-Host "     ✅ CORRECT (score >= 0.70)" -ForegroundColor Green
            }
            
            # Catégoriser
            if ($category.valeur -like "*Plomberie*") {
                $services_plomberie += @{id=$service_id; score=$score; category=$category.valeur}
            } elseif ($category.valeur -like "*Restauration*") {
                $services_restaurant += @{id=$service_id; score=$score; category=$category.valeur}
            } elseif ($category.valeur -like "*Commerce*" -or $category.valeur -like "*Librairie*") {
                $services_librairie += @{id=$service_id; score=$score; category=$category.valeur}
            } else {
                $autres_services += @{id=$service_id; score=$score; category=$category.valeur}
            }
        }
        
        Write-Host "`n3. Résumé par catégorie :" -ForegroundColor Cyan
        Write-Host "   - Services de plomberie: $($services_plomberie.Count)" -ForegroundColor White
        Write-Host "   - Services de restauration: $($services_restaurant.Count)" -ForegroundColor White
        Write-Host "   - Services de librairie/commerce: $($services_librairie.Count)" -ForegroundColor White
        Write-Host "   - Autres services: $($autres_services.Count)" -ForegroundColor White
        Write-Host "   - Services qui devraient être filtrés: $($services_filtres.Count)" -ForegroundColor Red
        
        if ($services_filtres.Count -gt 0) {
            Write-Host "`n🚨 PROBLÈME : Services avec score < 0.70 qui ne sont pas filtrés !" -ForegroundColor Red
            foreach ($service in $services_filtres) {
                Write-Host "   - Service $($service.id) (score: $($service.score)) - $($service.category)" -ForegroundColor Red
            }
        } else {
            Write-Host "`n✅ SUCCÈS : Tous les services respectent le seuil de 0.70" -ForegroundColor Green
        }
        
        if ($services_plomberie.Count -gt 0) {
            Write-Host "`n🚨 PROBLÈME : Services de plomberie trouvés pour une recherche de librairie !" -ForegroundColor Red
            foreach ($service in $services_plomberie) {
                Write-Host "   - Service $($service.id) (score: $($service.score)) - $($service.category)" -ForegroundColor Red
            }
        } else {
            Write-Host "`n✅ SUCCÈS : Aucun service de plomberie trouvé !" -ForegroundColor Green
        }
        
    } else {
        Write-Host "   ❌ Pas de résultats dans la réponse" -ForegroundColor Red
    }
    
} catch {
    Write-Host "   ❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Diagnostic terminé" -ForegroundColor Cyan 