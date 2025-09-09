# Script de test de pertinence des résultats de recherche
Write-Host "TEST DE PERTINENCE DES RÉSULTATS DE RECHERCHE" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

$BACKEND_API_URL = "http://localhost:3001"
$EMBEDDING_API_URL = "http://localhost:8000"

# Tests de pertinence avec différents types de services
$tests = @(
    @{
        query = "Je cherche un restaurant"
        expected_keywords = @("restaurant", "restauration", "cuisine", "manger", "repas")
        category = "Restauration"
        description = "Recherche de restaurants"
    },
    @{
        query = "Je cherche un plombier"
        expected_keywords = @("plombier", "plomberie", "tuyauterie", "réparation", "installation")
        category = "Plomberie"
        description = "Recherche de plombiers"
    },
    @{
        query = "Je cherche un électricien"
        expected_keywords = @("électricien", "électricité", "électrique", "installation", "réparation")
        category = "Électricité"
        description = "Recherche d'électriciens"
    },
    @{
        query = "Je cherche des livres scolaires"
        expected_keywords = @("livre", "scolaire", "école", "éducation", "étude", "manuel")
        category = "Éducation"
        description = "Recherche de livres scolaires"
    },
    @{
        query = "Je cherche un réparateur de vélos"
        expected_keywords = @("vélo", "bicyclette", "réparation", "mécanique", "cycle")
        category = "Réparation"
        description = "Recherche de réparateurs de vélos"
    },
    @{
        query = "Je cherche un coiffeur"
        expected_keywords = @("coiffeur", "coiffure", "salon", "cheveux", "coupe")
        category = "Coiffure"
        description = "Recherche de coiffeurs"
    }
)

# Fonction pour analyser la pertinence d'un service
function Test-ServiceRelevance {
    param(
        [string]$ServiceTitle,
        [string]$ServiceDescription,
        [string]$ServiceCategory,
        [array]$ExpectedKeywords
    )
    
    $relevance_score = 0
    $matched_keywords = @()
    
    # Vérifier le titre
    foreach ($keyword in $ExpectedKeywords) {
        if ($ServiceTitle -match $keyword -or $ServiceDescription -match $keyword -or $ServiceCategory -match $keyword) {
            $relevance_score += 1
            $matched_keywords += $keyword
        }
    }
    
    $relevance_percentage = if ($ExpectedKeywords.Count -gt 0) { ($relevance_score / $ExpectedKeywords.Count) * 100 } else { 0 }
    
    return @{
        Score = $relevance_score
        Percentage = $relevance_percentage
        MatchedKeywords = $matched_keywords
        IsRelevant = $relevance_percentage -ge 30  # Au moins 30% de mots-clés correspondants
    }
}

# Test principal
foreach ($test in $tests) {
    Write-Host "`n🔍 TEST: $($test.description)" -ForegroundColor Yellow
    Write-Host "Recherche: '$($test.query)'" -ForegroundColor White
    Write-Host "Mots-clés attendus: $($test.expected_keywords -join ', ')" -ForegroundColor Gray
    
    try {
        # Test direct du microservice
        Write-Host "`n1. Test microservice direct..." -ForegroundColor Cyan
        
        $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers @{
            "x-api-key" = "yukpo_embedding_key_2024"
            "Content-Type" = "application/json"
        } -Body (ConvertTo-Json @{
            query = $test.query
            type_donnee = "texte"
        })
        
        Write-Host "✅ Réponse microservice reçue" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor White
        
        # Analyser chaque résultat
        $relevant_results = 0
        $total_results = $response.results.Count
        
        foreach ($result in $response.results) {
            $service_id = $result.metadata.service_id
            $score = $result.score
            
            # Récupérer les détails du service depuis PostgreSQL
            $service_details = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/services/$service_id" -Method GET -Headers @{
                "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDU1MiwiaWF0IjoxNzU2NTE0NzIxLCJleHAiOjE3NTY2MDExMjF9.vhxziWLLYwVtJ-tDpo-pIZvVxUYkxQEpFjINpobK3-Y"
            } -ErrorAction SilentlyContinue
            
            if ($service_details) {
                $relevance = Test-ServiceRelevance -ServiceTitle $service_details.titre_service -ServiceDescription $service_details.description -ServiceCategory $service_details.category -ExpectedKeywords $test.expected_keywords
                
                $status = if ($relevance.IsRelevant) { "✅ PERTINENT" } else { "❌ NON PERTINENT" }
                $color = if ($relevance.IsRelevant) { "Green" } else { "Red" }
                
                Write-Host "Service $service_id (score: $($score.ToString('F3'))): $status" -ForegroundColor $color
                Write-Host "  Titre: $($service_details.titre_service)" -ForegroundColor Gray
                Write-Host "  Catégorie: $($service_details.category)" -ForegroundColor Gray
                Write-Host "  Pertinence: $($relevance.Percentage.ToString('F1'))% ($($relevance.MatchedKeywords -join ', '))" -ForegroundColor Gray
                
                if ($relevance.IsRelevant) {
                    $relevant_results++
                }
            } else {
                Write-Host "Service $service_id (score: $($score.ToString('F3'))): ⚠️ Détails non disponibles" -ForegroundColor Yellow
            }
        }
        
        $relevance_percentage = if ($total_results -gt 0) { ($relevant_results / $total_results) * 100 } else { 0 }
        
        Write-Host "`n📊 RÉSUMÉ PERTINENCE:" -ForegroundColor Magenta
        Write-Host "  Résultats pertinents: $relevant_results/$total_results ($($relevance_percentage.ToString('F1'))%)" -ForegroundColor White
        
        if ($relevance_percentage -ge 80) {
            Write-Host "  🎉 EXCELLENT: La plupart des résultats sont pertinents!" -ForegroundColor Green
        } elseif ($relevance_percentage -ge 60) {
            Write-Host "  ✅ BON: La majorité des résultats sont pertinents" -ForegroundColor Green
        } elseif ($relevance_percentage -ge 40) {
            Write-Host "  ⚠️ MOYEN: Beaucoup de résultats non pertinents" -ForegroundColor Yellow
        } else {
            Write-Host "  ❌ MAUVAIS: Trop de résultats non pertinents" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n" + ("-" * 60) -ForegroundColor Gray
}

Write-Host "`n🎯 TEST DE PERTINENCE TERMINÉ" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan 