# Test de pertinence simple
Write-Host "TEST DE PERTINENCE DES RÉSULTATS" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$EMBEDDING_API_URL = "http://localhost:8000"

# Tests variés
$searches = @(
    "Je cherche un restaurant",
    "Je cherche un plombier", 
    "Je cherche un électricien",
    "Je cherche des livres scolaires",
    "Je cherche un réparateur de vélos",
    "Je cherche un coiffeur"
)

foreach ($search in $searches) {
    Write-Host "`n🔍 TEST: '$search'" -ForegroundColor Yellow
    
    try {
        $body = @{
            query = $search
            type_donnee = "texte"
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
            "x-api-key" = "yukpo_embedding_key_2024"
            "Content-Type" = "application/json"
        } -Body $body
        
        Write-Host "✅ Réponse reçue - $($response.results.Count) résultats" -ForegroundColor Green
        
        # Analyser les 3 premiers résultats
        $count = 0
        foreach ($result in $response.results) {
            if ($count -ge 3) { break }
            
            $service_id = $result.metadata.service_id
            $score = $result.score
            
            Write-Host "  Service $service_id (score: $($score.ToString('F3')))" -ForegroundColor White
            
            # Vérifier la pertinence basique
            $search_lower = $search.ToLower()
            $is_relevant = $false
            
            if ($search_lower -match "restaurant" -and $service_id -match "restaurant") {
                $is_relevant = $true
            } elseif ($search_lower -match "plombier" -and $service_id -match "plombier") {
                $is_relevant = $true
            } elseif ($search_lower -match "électricien" -and $service_id -match "électricien") {
                $is_relevant = $true
            } elseif ($search_lower -match "livre" -and $service_id -match "livre") {
                $is_relevant = $true
            } elseif ($search_lower -match "vélo" -and $service_id -match "vélo") {
                $is_relevant = $true
            } elseif ($search_lower -match "coiffeur" -and $service_id -match "coiffeur") {
                $is_relevant = $true
            }
            
            $status = if ($is_relevant) { "✅ PERTINENT" } else { "❌ NON PERTINENT" }
            $color = if ($is_relevant) { "Green" } else { "Red" }
            Write-Host "    $status" -ForegroundColor $color
            
            $count++
        }
        
    } catch {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n" + ("-" * 50) -ForegroundColor Gray
}

Write-Host "`n🎯 TEST TERMINÉ" -ForegroundColor Cyan 