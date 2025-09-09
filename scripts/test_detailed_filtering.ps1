# Script de test détaillé du filtrage
Write-Host "TEST DÉTAILLÉ DU FILTRAGE" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$EMBEDDING_API_URL = "http://localhost:8000"

# Test avec différentes recherches
$searches = @(
    "Je cherche un restaurant",
    "Je cherche un plombier",
    "Je cherche un électricien"
)

foreach ($search in $searches) {
    Write-Host "`n🔍 RECHERCHE: '$search'" -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
            "x-api-key" = "yukpo_embedding_key_2024"
            "Content-Type" = "application/json"
        } -Body (ConvertTo-Json @{
            query = $search
            type_donnee = "texte"
        })
        
        Write-Host "✅ Réponse reçue - $($response.results.Count) résultats" -ForegroundColor Green
        
        # Analyser chaque résultat
        $above_threshold = 0
        $below_threshold = 0
        
        foreach ($result in $response.results) {
            $service_id = $result.metadata.service_id
            $score = $result.score
            
            if ($score -ge 0.70) {
                $above_threshold++
                Write-Host "  ✅ Service $service_id : score=$($score.ToString('F3')) (>= 0.70)" -ForegroundColor Green
            } else {
                $below_threshold++
                Write-Host "  ❌ Service $service_id : score=$($score.ToString('F3')) (< 0.70) - DEVRAIT ÊTRE FILTRÉ!" -ForegroundColor Red
            }
        }
        
        Write-Host "`n📊 STATISTIQUES:" -ForegroundColor Magenta
        Write-Host "  Résultats >= 0.70: $above_threshold" -ForegroundColor Green
        Write-Host "  Résultats < 0.70: $below_threshold" -ForegroundColor Red
        Write-Host "  Total: $($response.results.Count)" -ForegroundColor White
        
        if ($below_threshold -gt 0) {
            Write-Host "  🚨 PROBLÈME: $below_threshold services avec score < 0.70 ne sont PAS filtrés!" -ForegroundColor Red
        } else {
            Write-Host "  ✅ PARFAIT: Tous les services respectent le seuil de 0.70" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n" + ("-" * 50) -ForegroundColor Gray
}

Write-Host "`n🎯 TEST DÉTAILLÉ TERMINÉ" -ForegroundColor Cyan 