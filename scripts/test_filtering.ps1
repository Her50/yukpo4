# Script pour tester le filtrage des résultats
Write-Host "TEST DU FILTRAGE DES RESULTATS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"
$AUTH_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"

Write-Host "Test de recherche 'restaurant'..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
        "Authorization" = "Bearer $AUTH_TOKEN"
        "Content-Type" = "application/json"
    } -Body (ConvertTo-Json @{
        message = "Je cherche un restaurant"
        user_id = 1
    })

    Write-Host "Reponse recue" -ForegroundColor Green
    
    # Analyser les résultats
    if ($response.resultats -and $response.resultats.results) {
        Write-Host "Analyse des resultats :" -ForegroundColor Yellow
        Write-Host "   - Nombre total de resultats: $($response.resultats.results.Count)" -ForegroundColor White
        Write-Host "   - Seuil applique: $($response.threshold_applied)" -ForegroundColor White
        
        $services_plomberie = @()
        $services_restaurant = @()
        $autres_services = @()
        
        foreach ($result in $response.resultats.results) {
            $score = $result.score
            $service_id = $result.metadata.service_id
            $category = $result.metadata.ia_response | ConvertFrom-Json | Select-Object -ExpandProperty category
            
            if ($score -lt 0.70) {
                Write-Host "   Service $service_id avec score $score (< 0.70) - $($category.valeur)" -ForegroundColor Red
            } else {
                Write-Host "   Service $service_id avec score $score (>= 0.70) - $($category.valeur)" -ForegroundColor Green
            }
            
            # Catégoriser
            if ($category.valeur -like "*Plomberie*") {
                $services_plomberie += @{id=$service_id; score=$score; category=$category.valeur}
            } elseif ($category.valeur -like "*Restauration*") {
                $services_restaurant += @{id=$service_id; score=$score; category=$category.valeur}
            } else {
                $autres_services += @{id=$service_id; score=$score; category=$category.valeur}
            }
        }
        
        Write-Host "Resume :" -ForegroundColor Cyan
        Write-Host "   - Services de plomberie: $($services_plomberie.Count)" -ForegroundColor White
        Write-Host "   - Services de restauration: $($services_restaurant.Count)" -ForegroundColor White
        Write-Host "   - Autres services: $($autres_services.Count)" -ForegroundColor White
        
        if ($services_plomberie.Count -gt 0) {
            Write-Host "PROBLEME : Services de plomberie trouves pour une recherche de restaurant !" -ForegroundColor Red
            foreach ($service in $services_plomberie) {
                Write-Host "   - Service $($service.id) (score: $($service.score)) - $($service.category)" -ForegroundColor Red
            }
        } else {
            Write-Host "SUCCES : Aucun service de plomberie trouve !" -ForegroundColor Green
        }
        
    } else {
        Write-Host "Pas de resultats dans la reponse" -ForegroundColor Red
    }
    
} catch {
    Write-Host "Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test termine" -ForegroundColor Cyan 