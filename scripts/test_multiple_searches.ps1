# Script de test multiple pour analyser le comportement du filtrage
Write-Host "TEST MULTIPLE DE RECHERCHES" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"
$EMBEDDING_API_URL = "http://localhost:8000"

# Tests à effectuer
$tests = @(
    @{query="Je cherche une librairie"; expected_category="Commerce"},
    @{query="Je cherche un restaurant"; expected_category="Restauration"},
    @{query="Je cherche un plombier"; expected_category="Plomberie"},
    @{query="Je cherche un électricien"; expected_category="Électricité"},
    @{query="Je cherche un coiffeur"; expected_category="Coiffure"}
)

Write-Host "1. Test du microservice d'embedding direct..." -ForegroundColor Yellow

foreach ($test in $tests) {
    Write-Host "`n--- Test: '$($test.query)' ---" -ForegroundColor Green
    
    try {
        # Test direct du microservice d'embedding
        $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
            "x-api-key" = "yukpo_embedding_key_2024"
            "Content-Type" = "application/json"
        } -Body (ConvertTo-Json @{
            query = $test.query
            type_donnee = "texte"
            top_k = 10
            active = $true
        })

        Write-Host "   ✅ Réponse microservice reçue" -ForegroundColor Green
        Write-Host "   - Nombre de résultats: $($response.results.Count)" -ForegroundColor White
        
        # Analyser les scores
        $services_above_threshold = 0
        $services_below_threshold = 0
        $services_plomberie = 0
        $services_restaurant = 0
        $services_electricite = 0
        
        foreach ($result in $response.results) {
            $score = $result.score
            $service_id = $result.metadata.service_id
            
            if ($score -ge 0.70) {
                $services_above_threshold++
                Write-Host "     ✅ Service $service_id : score=$score (>= 0.70)" -ForegroundColor Green
            } else {
                $services_below_threshold++
                Write-Host "     ❌ Service $service_id : score=$score (-lt 0.70) - DEVRAIT ÊTRE FILTRÉ" -ForegroundColor Red
            }
        }
        
        Write-Host "   📊 Résumé:" -ForegroundColor Cyan
        Write-Host "     - Services >= 0.70: $services_above_threshold" -ForegroundColor White
        Write-Host "     - Services -lt 0.70: $services_below_threshold" -ForegroundColor White
        
        if ($services_below_threshold -gt 0) {
            Write-Host "     🚨 PROBLÈME: $services_below_threshold services avec score -lt 0.70 ne sont pas filtrés!" -ForegroundColor Red
        } else {
            Write-Host "     ✅ SUCCÈS: Tous les services respectent le seuil de 0.70" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "   ❌ Erreur microservice: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n2. Test du backend complet..." -ForegroundColor Yellow

foreach ($test in $tests) {
    Write-Host "`n--- Test backend: '$($test.query)' ---" -ForegroundColor Green
    
    try {
        # Test du backend complet
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/ia/auto" -Method POST -Headers @{
            "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDQxMiwiaWF0IjoxNzU2NTE2MTY2LCJleHAiOjE3NTY2MDI1NjZ9.KqaQQb-UmDyZ1Y7SGMXCaukCxLF9QDqRodVBaPQWUII"
            "Content-Type" = "application/json"
        } -Body (ConvertTo-Json @{
            message = $test.query
            user_id = 1
        })

        Write-Host "   ✅ Réponse backend reçue" -ForegroundColor Green
        
        if ($response.resultats -and $response.resultats.results) {
            Write-Host "   - Nombre de résultats: $($response.resultats.results.Count)" -ForegroundColor White
            Write-Host "   - Seuil appliqué: $($response.threshold_applied)" -ForegroundColor White
            
            $services_above_threshold = 0
            $services_below_threshold = 0
            
            foreach ($result in $response.resultats.results) {
                $score = $result.score
                $service_id = $result.metadata.service_id
                
                if ($score -ge 0.70) {
                    $services_above_threshold++
                } else {
                    $services_below_threshold++
                    Write-Host "     ❌ Service $service_id : score=$score (-lt 0.70) - DEVRAIT ÊTRE FILTRÉ" -ForegroundColor Red
                }
            }
            
            Write-Host "   📊 Résumé backend:" -ForegroundColor Cyan
            Write-Host "     - Services >= 0.70: $services_above_threshold" -ForegroundColor White
            Write-Host "     - Services -lt 0.70: $services_below_threshold" -ForegroundColor White
            
            if ($services_below_threshold -gt 0) {
                Write-Host "     🚨 PROBLÈME BACKEND: $services_below_threshold services avec score -lt 0.70 ne sont pas filtrés!" -ForegroundColor Red
            } else {
                Write-Host "     ✅ SUCCÈS BACKEND: Tous les services respectent le seuil de 0.70" -ForegroundColor Green
            }
        } else {
            Write-Host "   ❌ Pas de résultats dans la réponse backend" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "   ❌ Erreur backend: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Tests multiples terminés" -ForegroundColor Cyan 