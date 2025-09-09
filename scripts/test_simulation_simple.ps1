# Script de test de simulation reelle utilisant l'IA de votre backend Rust
# Version simplifiee sans caracteres speciaux

Write-Host "TEST SIMULATION REELLE - UTILISATION DE VOTRE CODE RUST" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Ce script utilise votre endpoint /api/yukpo pour creer des services via IA" -ForegroundColor White
Write-Host "et tester ensuite les recherches pour analyser les problemes/incoherences" -ForegroundColor White
Write-Host "INCLUT DES DELAIS POUR LA SYNCHRONISATION DES EMBEDDINGS PINECONE" -ForegroundColor Yellow
Write-Host "ANALYSE DE LA PERTINENCE DES MATCHING SEMANTIQUES" -ForegroundColor Magenta

# Configuration
$BACKEND_API_URL = "http://localhost:3001"
$EMBEDDING_API_URL = "http://localhost:8000"
$JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxODAwMCwiaWF0IjoxNzU2MzgyOTk2LCJleHAiOjE3NTY0NjkzOTZ9.3z2QKy4AuuxU2p1Sp5iOe7zHX7nISsY0mxEfGSLQ8M8"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT_TOKEN"
}

$embeddingHeaders = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

# Fonction pour analyser la pertinence des matching semantiques
function Analyze-SemanticRelevance {
    param(
        [string]$SearchQuery,
        [string]$ExpectedCategory,
        [object]$SearchResults,
        [string]$ServiceType
    )
    
    Write-Host "   ANALYSE PERTINENCE SEMANTIQUE:" -ForegroundColor Magenta
    
    if (-not $SearchResults -or $SearchResults.detail -eq "Not Found") {
        Write-Host "      Aucun resultat a analyser" -ForegroundColor Red
        return @{
            RelevanceScore = 0
            CategoryMatch = $false
            SemanticQuality = "Aucun resultat"
            Issues = @("Aucun service trouve")
        }
    }
    
    # Analyser les resultats via l'API d'embedding directe
    $embeddingPayload = @{
        query = $SearchQuery
        type_donnee = "texte"
        top_k = 10
        active = $true
    } | ConvertTo-Json -Depth 10
    
    try {
        $embeddingResponse = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers $embeddingHeaders -Body $embeddingPayload -TimeoutSec 30
        
        if ($embeddingResponse.results -and $embeddingResponse.results.Count -gt 0) {
            Write-Host "      $($embeddingResponse.results.Count) resultats Pinecone trouves" -ForegroundColor White
            
            # Analyser la pertinence des scores
            $scores = $embeddingResponse.results | ForEach-Object { $_.score }
            $bestScore = ($scores | Measure-Object -Maximum).Maximum
            $avgScore = ($scores | Measure-Object -Average).Average
            $minScore = ($scores | Measure-Object -Minimum).Minimum
            
            Write-Host "      Scores: Max=$([math]::Round($bestScore, 3)), Moy=$([math]::Round($avgScore, 3)), Min=$([math]::Round($minScore, 3))" -ForegroundColor White
            
            # Evaluer la qualite des scores
            $scoreQuality = if ($bestScore -ge 0.8) { "Excellent" } elseif ($bestScore -ge 0.7) { "Bon" } elseif ($bestScore -ge 0.6) { "Moyen" } else { "Faible" }
            Write-Host "      Qualite des scores: $scoreQuality" -ForegroundColor $(if ($scoreQuality -eq "Excellent") { "Green" } elseif ($scoreQuality -eq "Bon") { "Cyan" } elseif ($scoreQuality -eq "Moyen") { "Yellow" } else { "Red" })
            
            # Verifier la coherence des categories
            $categoryMatches = 0
            $semanticIssues = @()
            
            foreach ($result in $embeddingResponse.results) {
                if ($result.metadata -and $result.metadata.category) {
                    $resultCategory = $result.metadata.category
                    if ($resultCategory -eq $ExpectedCategory) {
                        $categoryMatches++
                    } else {
                        $semanticIssues += "Categorie '$resultCategory' au lieu de '$ExpectedCategory' (score: $([math]::Round($result.score, 3)))"
                    }
                }
            }
            
            $categoryMatchRate = if ($embeddingResponse.results.Count -gt 0) { [math]::Round(($categoryMatches / $embeddingResponse.results.Count) * 100, 1) } else { 0 }
            Write-Host "      Correspondance categorie: $categoryMatches/$($embeddingResponse.results.Count) ($categoryMatchRate%)" -ForegroundColor $(if ($categoryMatchRate -ge 80) { "Green" } elseif ($categoryMatchRate -ge 60) { "Yellow" } else { "Red" })
            
            # Calculer un score de pertinence global
            $relevanceScore = [math]::Round(($bestScore * 0.4) + ($avgScore * 0.3) + ($categoryMatchRate / 100 * 0.3), 3)
            
            # Identifier les problemes
            $issues = @()
            if ($bestScore -lt 0.7) { $issues += "Score semantique trop faible (< 0.7)" }
            if ($categoryMatchRate -lt 60) { $issues += "Faible correspondance de categorie (< 60%)" }
            if ($avgScore -lt 0.6) { $issues += "Score moyen insuffisant (< 0.6)" }
            
            # Ajouter les problemes semantiques specifiques
            $issues += $semanticIssues
            
            $semanticQuality = if ($relevanceScore -ge 0.8) { "Excellent" } elseif ($relevanceScore -ge 0.6) { "Bon" } elseif ($relevanceScore -ge 0.4) { "Moyen" } else { "Faible" }
            
            Write-Host "      Score de pertinence global: $relevanceScore ($semanticQuality)" -ForegroundColor $(if ($semanticQuality -eq "Excellent") { "Green" } elseif ($semanticQuality -eq "Bon") { "Cyan" } elseif ($semanticQuality -eq "Moyen") { "Yellow" } else { "Red" })
            
            if ($issues.Count -gt 0) {
                Write-Host "      Problemes detectes:" -ForegroundColor Yellow
                foreach ($issue in $issues) {
                    Write-Host "         - $issue" -ForegroundColor Yellow
                }
            }
            
            return @{
                RelevanceScore = $relevanceScore
                CategoryMatch = $categoryMatchRate -ge 60
                SemanticQuality = $semanticQuality
                BestScore = $bestScore
                AvgScore = $avgScore
                CategoryMatchRate = $categoryMatchRate
                Issues = $issues
                ResultsCount = $embeddingResponse.results.Count
            }
            
        } else {
            Write-Host "      Aucun resultat Pinecone trouve" -ForegroundColor Red
            return @{
                RelevanceScore = 0
                CategoryMatch = $false
                SemanticQuality = "Aucun resultat"
                Issues = @("Aucun embedding trouve dans Pinecone")
            }
        }
        
    } catch {
        Write-Host "      Erreur analyse embedding: $($_.Exception.Message)" -ForegroundColor Red
        return @{
            RelevanceScore = 0
            CategoryMatch = $false
            SemanticQuality = "Erreur"
            Issues = @("Erreur acces Pinecone: $($_.Exception.Message)")
        }
    }
}

# Fonction pour verifier la disponibilite des embeddings dans Pinecone
function Test-EmbeddingAvailability {
    param(
        [string]$ServiceType,
        [string]$SearchQuery
    )
    
    Write-Host "   Verification embedding pour: '$SearchQuery'" -ForegroundColor Gray
    
    $payload = @{
        query = $SearchQuery
        type_donnee = "texte"
        top_k = 5
        active = $true
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers $embeddingHeaders -Body $payload -TimeoutSec 30
        
        if ($response.results -and $response.results.Count -gt 0) {
            $bestScore = ($response.results | Sort-Object score -Descending | Select-Object -First 1).score
            Write-Host "   Embedding disponible - Meilleur score: $([math]::Round($bestScore, 3))" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   Aucun embedding trouve" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "   Erreur verification embedding: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction pour attendre la synchronisation des embeddings
function Wait-EmbeddingSync {
    param(
        [string]$ServiceType,
        [string]$SearchQuery,
        [int]$MaxWaitSeconds = 60
    )
    
    Write-Host "   Attente synchronisation embedding Pinecone..." -ForegroundColor Yellow
    
    $startTime = Get-Date
    $elapsedSeconds = 0
    
    while ($elapsedSeconds -lt $MaxWaitSeconds) {
        if (Test-EmbeddingAvailability -ServiceType $ServiceType -SearchQuery $SearchQuery) {
            $elapsedSeconds = [math]::Round((Get-Date - $startTime).TotalSeconds, 0)
            Write-Host "   Embedding synchronise en ${elapsedSeconds}s" -ForegroundColor Green
            return $true
        }
        
        Start-Sleep -Seconds 5
        $elapsedSeconds = [math]::Round((Get-Date - $startTime).TotalSeconds, 0)
        
        if ($elapsedSeconds % 15 -eq 0) {
            Write-Host "   Encore en attente... (${elapsedSeconds}s ecoulees)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "   Timeout - Embedding non synchronise apres ${MaxWaitSeconds}s" -ForegroundColor Red
    return $false
}

# Fonction pour creer un service via l'IA
function Create-ServiceViaIA {
    param(
        [string]$UserNeed,
        [string]$ServiceType
    )
    
    Write-Host "`nCreation de service: $ServiceType" -ForegroundColor Yellow
    Write-Host "Besoin exprime: '$UserNeed'" -ForegroundColor Gray
    
    $payload = @{
        user_input = $UserNeed
        user_id = 1
        context = "creation_service"
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 60
        
        if ($response.intention -eq "creation_service") {
            Write-Host "Service cree avec succes via IA!" -ForegroundColor Green
            Write-Host "   Intention detectee: $($response.intention)" -ForegroundColor White
            Write-Host "   Titre: $($response.titre.valeur)" -ForegroundColor White
            Write-Host "   Categorie: $($response.category.valeur)" -ForegroundColor White
            Write-Host "   Tokens consommes: $($response.tokens_consumed)" -ForegroundColor Cyan
            
            # Attendre la synchronisation des embeddings
            Write-Host "   Attente synchronisation Pinecone..." -ForegroundColor Yellow
            $syncSuccess = Wait-EmbeddingSync -ServiceType $ServiceType -SearchQuery $UserNeed
            
            if ($syncSuccess) {
                Write-Host "   Service pret pour les tests de recherche" -ForegroundColor Green
            } else {
                Write-Host "   Service cree mais embedding non synchronise" -ForegroundColor Yellow
            }
            
            return @{
                Response = $response
                EmbeddingSynced = $syncSuccess
            }
        } else {
            Write-Host "Intention incorrecte detectee: $($response.intention)" -ForegroundColor Red
            return $null
        }
    } catch {
        Write-Host "Erreur creation service: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Fonction pour tester la recherche avec analyse de pertinence
function Test-SearchWithRelevance {
    param(
        [string]$SearchQuery,
        [string]$ExpectedCategory,
        [string]$ServiceType
    )
    
    Write-Host "`nTest de recherche: '$SearchQuery'" -ForegroundColor Blue
    Write-Host "   Categorie attendue: $ExpectedCategory" -ForegroundColor Gray
    
    $payload = @{
        user_input = $SearchQuery
        user_id = 1
        context = "recherche_besoin"
    } | ConvertTo-Json -Depth 10
    
    try {
        $startTime = Get-Date
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 60
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        Write-Host "   Temps de reponse: ${duration}ms" -ForegroundColor Cyan
        Write-Host "   Intention detectee: $($response.intention)" -ForegroundColor White
        Write-Host "   Modele IA utilise: $($response.ia_model_used)" -ForegroundColor White
        Write-Host "   Tokens consommes: $($response.tokens_consumed)" -ForegroundColor Yellow
        
        # Analyser les resultats
        if ($response.resultats -and $response.resultats.detail -ne "Not Found") {
            Write-Host "   Resultats trouves" -ForegroundColor Green
        } else {
            Write-Host "   Aucun resultat trouve (Not Found)" -ForegroundColor Yellow
        }
        
        # ANALYSE DE LA PERTINENCE SEMANTIQUE
        $relevanceAnalysis = Analyze-SemanticRelevance -SearchQuery $SearchQuery -ExpectedCategory $ExpectedCategory -SearchResults $response.resultats -ServiceType $ServiceType
        
        return @{
            Response = $response
            RelevanceAnalysis = $relevanceAnalysis
            Duration = $duration
        }
        
    } catch {
        Write-Host "   Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Liste des services a creer (version reduite pour le test)
$servicesToCreate = @(
    @{
        Type = "Mecanicien automobile"
        Need = "J'ai besoin d'un mecanicien pour reparer ma voiture qui ne demarre plus"
    },
    @{
        Type = "Plombier"
        Need = "Je cherche un plombier pour reparer une fuite d'eau dans ma salle de bain"
    },
    @{
        Type = "Electricien"
        Need = "J'ai besoin d'un electricien pour installer des prises electriques dans ma maison"
    }
)

# PHASE 1: CREATION DES SERVICES VIA IA
Write-Host "`nPHASE 1: CREATION DES SERVICES VIA IA" -ForegroundColor Magenta
Write-Host "=" * 50 -ForegroundColor Magenta
Write-Host "Cette phase inclut des delais pour la synchronisation Pinecone" -ForegroundColor Yellow

$createdServices = @()
$successCount = 0
$failureCount = 0
$embeddingSyncCount = 0

foreach ($service in $servicesToCreate) {
    $result = Create-ServiceViaIA -UserNeed $service.Need -ServiceType $service.Type
    
    if ($result) {
        $createdServices += @{
            Type = $service.Type
            Need = $service.Need
            Response = $result.Response
            EmbeddingSynced = $result.EmbeddingSynced
        }
        $successCount++
        
        if ($result.EmbeddingSynced) {
            $embeddingSyncCount++
        }
    } else {
        $failureCount++
    }
    
    # Pause entre les creations
    Write-Host "   Pause de 5 secondes pour laisser le temps aux embeddings..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
}

Write-Host "`nRESUME CREATION:" -ForegroundColor Green
Write-Host "   Services crees avec succes: $successCount" -ForegroundColor Green
Write-Host "   Embeddings synchronises: $embeddingSyncCount" -ForegroundColor Cyan
Write-Host "   Echecs: $failureCount" -ForegroundColor Red
Write-Host "   Total tentatives: $($servicesToCreate.Count)" -ForegroundColor White

# PHASE 2: TESTS DE RECHERCHE AVEC ANALYSE DE PERTINENCE
Write-Host "`nPHASE 2: TESTS DE RECHERCHE AVEC ANALYSE DE PERTINENCE" -ForegroundColor Magenta
Write-Host "=" * 70 -ForegroundColor Magenta
Write-Host "Seuls les services avec embeddings synchronises seront testes" -ForegroundColor Yellow
Write-Host "Analyse approfondie de la pertinence des matching semantiques" -ForegroundColor Magenta

$servicesReadyForSearch = $createdServices | Where-Object { $_.EmbeddingSynced }
$servicesNotReady = $createdServices | Where-Object { -not $_.EmbeddingSynced }

if ($servicesNotReady.Count -gt 0) {
    Write-Host "`nSERVICES NON PRETS POUR LA RECHERCHE:" -ForegroundColor Yellow
    foreach ($service in $servicesNotReady) {
        Write-Host "   $($service.Type) - Embedding non synchronise" -ForegroundColor Red
    }
}

if ($servicesReadyForSearch.Count -eq 0) {
    Write-Host "`nAucun service pret pour les tests de recherche!" -ForegroundColor Red
    Write-Host "   Verifiez la configuration Pinecone et les delais de synchronisation" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nSERVICES PRETS POUR LA RECHERCHE: $($servicesReadyForSearch.Count)" -ForegroundColor Green

# Cas de recherche pour chaque service pret
$searchTests = @()

foreach ($service in $servicesReadyForSearch) {
    $serviceType = $service.Type
    $searchQueries = @(
        "Je cherche un $serviceType",
        "Besoin urgent de $serviceType"
    )
    
    foreach ($query in $searchQueries) {
        $searchTests += @{
            ServiceType = $serviceType
            Query = $query
            ExpectedCategory = $service.Response.category.valeur
        }
    }
}

Write-Host "`nExecution de $($searchTests.Count) tests de recherche avec analyse de pertinence..." -ForegroundColor Yellow

$searchResults = @()
$totalSearchTime = 0
$totalTokens = 0
$relevanceScores = @()
$semanticQualityStats = @{}

foreach ($test in $searchTests) {
    $result = Test-SearchWithRelevance -SearchQuery $test.Query -ExpectedCategory $test.ExpectedCategory -ServiceType $test.ServiceType
    
    if ($result) {
        $searchResults += @{
            Test = $test
            Result = $result.Response
            RelevanceAnalysis = $result.RelevanceAnalysis
            Duration = $result.Duration
            Success = $true
        }
        $totalTokens += $result.Response.tokens_consumed
        
        # Collecter les scores de pertinence
        if ($result.RelevanceAnalysis.RelevanceScore -gt 0) {
            $relevanceScores += $result.RelevanceAnalysis.RelevanceScore
        }
        
        # Statistiques de qualite semantique
        $quality = $result.RelevanceAnalysis.SemanticQuality
        if ($semanticQualityStats.ContainsKey($quality)) {
            $semanticQualityStats[$quality]++
        } else {
            $semanticQualityStats[$quality] = 1
        }
        
    } else {
        $searchResults += @{
            Test = $test
            Result = $null
            RelevanceAnalysis = $null
            Duration = 0
            Success = $false
        }
    }
    
    # Pause entre les recherches
    Start-Sleep -Seconds 2
}

# ANALYSE DES RESULTATS AVEC PERTINENCE SEMANTIQUE
Write-Host "`nANALYSE DES RESULTATS AVEC PERTINENCE SEMANTIQUE" -ForegroundColor Magenta
Write-Host "=" * 70 -ForegroundColor Magenta

$successfulSearches = $searchResults | Where-Object { $_.Success }
$failedSearches = $searchResults | Where-Object { -not $_.Success }

Write-Host "RECHERCHES:" -ForegroundColor White
Write-Host "   Reussies: $($successfulSearches.Count)" -ForegroundColor Green
Write-Host "   Echouees: $($failedSearches.Count)" -ForegroundColor Red
Write-Host "   Taux de succes: $([math]::Round(($successfulSearches.Count / $searchResults.Count) * 100, 2))%" -ForegroundColor Cyan

Write-Host "`nCONSOMMATION TOKENS:" -ForegroundColor White
Write-Host "   Total tokens consommes: $totalTokens" -ForegroundColor Yellow
Write-Host "   Moyenne par recherche: $([math]::Round($totalTokens / $searchResults.Count, 2))" -ForegroundColor Yellow

# ANALYSE DE LA PERTINENCE SEMANTIQUE
Write-Host "`nANALYSE DE LA PERTINENCE SEMANTIQUE:" -ForegroundColor Magenta
Write-Host "=" * 50 -ForegroundColor Magenta

if ($relevanceScores.Count -gt 0) {
    $avgRelevance = ($relevanceScores | Measure-Object -Average).Average
    $maxRelevance = ($relevanceScores | Measure-Object -Maximum).Maximum
    $minRelevance = ($relevanceScores | Measure-Object -Minimum).Minimum
    
    Write-Host "SCORES DE PERTINENCE:" -ForegroundColor White
    Write-Host "   Score moyen: $([math]::Round($avgRelevance, 3))" -ForegroundColor Cyan
    Write-Host "   Score maximum: $([math]::Round($maxRelevance, 3))" -ForegroundColor Green
    Write-Host "   Score minimum: $([math]::Round($minRelevance, 3))" -ForegroundColor Yellow
    
    # Distribution de la qualite semantique
    Write-Host "`nDISTRIBUTION QUALITE SEMANTIQUE:" -ForegroundColor White
    foreach ($quality in $semanticQualityStats.Keys | Sort-Object) {
        $count = $semanticQualityStats[$quality]
        $percentage = [math]::Round(($count / $relevanceScores.Count) * 100, 1)
        $color = switch ($quality) {
            "Excellent" { "Green" }
            "Bon" { "Cyan" }
            "Moyen" { "Yellow" }
            default { "Red" }
        }
        Write-Host "   $quality: $count ($percentage%)" -ForegroundColor $color
    }
    
    # Evaluation globale
    $globalQuality = if ($avgRelevance -ge 0.8) { "EXCELLENT" } elseif ($avgRelevance -ge 0.6) { "BON" } elseif ($avgRelevance -ge 0.4) { "MOYEN" } else { "FAIBLE" }
    $globalColor = switch ($globalQuality) {
        "EXCELLENT" { "Green" }
        "BON" { "Cyan" }
        "MOYEN" { "Yellow" }
        default { "Red" }
    }
    
    Write-Host "`nQUALITE GLOBALE DU MATCHING SEMANTIQUE: $globalQuality" -ForegroundColor $globalColor
    Write-Host "   Score moyen: $([math]::Round($avgRelevance, 3))" -ForegroundColor White
    
} else {
    Write-Host "   Aucun score de pertinence disponible" -ForegroundColor Yellow
}

Write-Host "`nTEST TERMINE!" -ForegroundColor Green
Write-Host "Services crees: $successCount" -ForegroundColor White
Write-Host "Embeddings synchronises: $embeddingSyncCount" -ForegroundColor Cyan
Write-Host "Tests de recherche: $($searchResults.Count)" -ForegroundColor White
Write-Host "Taux de succes: $([math]::Round(($successfulSearches.Count / $searchResults.Count) * 100, 2))%" -ForegroundColor White
if ($relevanceScores.Count -gt 0) {
    Write-Host "Pertinence semantique moyenne: $([math]::Round($avgRelevance, 3))" -ForegroundColor Magenta
} 