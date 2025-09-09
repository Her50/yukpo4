# Script de test de pertinence simple
Write-Host "TEST DE PERTINENCE SIMPLE" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"
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
        # Test microservice direct
        $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
            "x-api-key" = "yukpo_embedding_key_2024"
            "Content-Type" = "application/json"
        } -Body (ConvertTo-Json @{
            query = $search
            type_donnee = "texte"
        })
        
        Write-Host "✅ Réponse reçue - $($response.results.Count) résultats" -ForegroundColor Green
        
        # Analyser les 3 premiers résultats
        $count = 0
        foreach ($result in $response.results) {
            if ($count -ge 3) { break }
            
            $service_id = $result.metadata.service_id
            $score = $result.score
            
            Write-Host "  Service $service_id (score: $($score.ToString('F3')))" -ForegroundColor White
            
            # Vérifier si le service existe dans PostgreSQL
            try {
                $service_details = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/services/$service_id" -Method GET -Headers @{
                    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"
                } -ErrorAction Stop
                
                Write-Host "    Titre: $($service_details.titre_service)" -ForegroundColor Gray
                Write-Host "    Catégorie: $($service_details.category)" -ForegroundColor Gray
                
                # Vérifier la pertinence basique
                $search_lower = $search.ToLower()
                $title_lower = $service_details.titre_service.ToLower()
                $category_lower = $service_details.category.ToLower()
                
                $is_relevant = $false
                if ($search_lower -match "restaurant" -and ($title_lower -match "restaurant" -or $category_lower -match "restauration")) {
                    $is_relevant = $true
                } elseif ($search_lower -match "plombier" -and ($title_lower -match "plombier" -or $category_lower -match "plomberie")) {
                    $is_relevant = $true
                } elseif ($search_lower -match "électricien" -and ($title_lower -match "électricien" -or $category_lower -match "électricité")) {
                    $is_relevant = $true
                } elseif ($search_lower -match "livre" -and ($title_lower -match "livre" -or $category_lower -match "éducation")) {
                    $is_relevant = $true
                } elseif ($search_lower -match "vélo" -and ($title_lower -match "vélo" -or $title_lower -match "bicyclette")) {
                    $is_relevant = $true
                } elseif ($search_lower -match "coiffeur" -and ($title_lower -match "coiffeur" -or $category_lower -match "coiffure")) {
                    $is_relevant = $true
                }
                
                $status = if ($is_relevant) { "✅ PERTINENT" } else { "❌ NON PERTINENT" }
                $color = if ($is_relevant) { "Green" } else { "Red" }
                Write-Host "    $status" -ForegroundColor $color
                
            } catch {
                Write-Host "    ⚠️ Service non trouvé dans PostgreSQL" -ForegroundColor Yellow
            }
            
            $count++
        }
        
    } catch {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n" + ("-" * 50) -ForegroundColor Gray
}

Write-Host "`n🎯 TEST TERMINÉ" -ForegroundColor Cyan 