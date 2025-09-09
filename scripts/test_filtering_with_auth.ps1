# Script pour tester le filtrage avec authentification
Write-Host "TEST DU FILTRAGE AVEC AUTHENTIFICATION" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"

Write-Host "1. Test de connexion au backend..." -ForegroundColor Yellow
try {
    $ping_response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/test/ping" -Method GET
    Write-Host "   ✅ Backend accessible: $($ping_response.message)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Authentification..." -ForegroundColor Yellow
try {
    $auth_response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/auth/login" -Method POST -Headers @{
        "Content-Type" = "application/json"
    } -Body (ConvertTo-Json @{
        email = "lelehernandez2007@yahoo.fr"
        password = "Hernandez87"
    })
    
    $token = $auth_response.token
    Write-Host "   ✅ Token obtenu: $($token.Substring(0, 20))..." -ForegroundColor Green
} catch {
    Write-Host "   ❌ Erreur authentification: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Utilisation d'un token de test..." -ForegroundColor Yellow
    
    # Token de test (à remplacer par un vrai token)
    $token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"
}

Write-Host "`n3. Test de recherche 'restaurant'..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -Body (ConvertTo-Json @{
        message = "Je cherche un restaurant"
        user_id = 1
    })

    Write-Host "   ✅ Réponse reçue" -ForegroundColor Green
    
    # Analyser les résultats
    if ($response.resultats -and $response.resultats.results) {
        Write-Host "`n4. Analyse des résultats :" -ForegroundColor Yellow
        Write-Host "   - Nombre total de résultats: $($response.resultats.results.Count)" -ForegroundColor White
        Write-Host "   - Seuil appliqué: $($response.threshold_applied)" -ForegroundColor White
        
        $services_plomberie = @()
        $services_restaurant = @()
        $autres_services = @()
        
        foreach ($result in $response.resultats.results) {
            $score = $result.score
            $service_id = $result.metadata.service_id
            $category = $result.metadata.ia_response | ConvertFrom-Json | Select-Object -ExpandProperty category
            
            if ($score -lt 0.70) {
                Write-Host "   ⚠️  Service $service_id avec score $score (< 0.70) - $($category.valeur)" -ForegroundColor Red
            } else {
                Write-Host "   ✅ Service $service_id avec score $score (>= 0.70) - $($category.valeur)" -ForegroundColor Green
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
        
        Write-Host "`n5. Résumé :" -ForegroundColor Cyan
        Write-Host "   - Services de plomberie: $($services_plomberie.Count)" -ForegroundColor White
        Write-Host "   - Services de restauration: $($services_restaurant.Count)" -ForegroundColor White
        Write-Host "   - Autres services: $($autres_services.Count)" -ForegroundColor White
        
        if ($services_plomberie.Count -gt 0) {
            Write-Host "`n🚨 PROBLÈME : Services de plomberie trouvés pour une recherche de restaurant !" -ForegroundColor Red
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

Write-Host "`n🎯 Test terminé" -ForegroundColor Cyan 