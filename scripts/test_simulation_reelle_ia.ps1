# Script de test de simulation réelle utilisant l'IA de votre backend Rust
# Ce script utilise l'endpoint /api/yukpo pour créer des services via IA
# INCLUT DES DÉLAIS POUR LA SYNCHRONISATION DES EMBEDDINGS PINECONE
# ET ANALYSE DE LA PERTINENCE DES MATCHING SÉMANTIQUES

Write-Host "🚀 TEST SIMULATION RÉELLE - UTILISATION DE VOTRE CODE RUST" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "Ce script utilise votre endpoint /api/yukpo pour créer des services via IA" -ForegroundColor White
Write-Host "et tester ensuite les recherches pour analyser les problèmes/incohérences" -ForegroundColor White
Write-Host "⚠️  INCLUT DES DÉLAIS POUR LA SYNCHRONISATION DES EMBEDDINGS PINECONE" -ForegroundColor Yellow
Write-Host "🎯 ANALYSE DE LA PERTINENCE DES MATCHING SÉMANTIQUES" -ForegroundColor Magenta

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

# Fonction pour analyser la pertinence des matching sémantiques
function Analyze-SemanticRelevance {
    param(
        [string]$SearchQuery,
        [string]$ExpectedCategory,
        [object]$SearchResults,
        [string]$ServiceType
    )
    
    Write-Host "   🎯 ANALYSE PERTINENCE SÉMANTIQUE:" -ForegroundColor Magenta
    
    if (-not $SearchResults -or $SearchResults.detail -eq "Not Found") {
        Write-Host "      ❌ Aucun résultat à analyser" -ForegroundColor Red
        return @{
            RelevanceScore = 0
            CategoryMatch = $false
            SemanticQuality = "Aucun résultat"
            Issues = @("Aucun service trouvé")
        }
    }
    
    # Analyser les résultats via l'API d'embedding directe
    $embeddingPayload = @{
        query = $SearchQuery
        type_donnee = "texte"
        top_k = 10
        active = $true
    } | ConvertTo-Json -Depth 10
    
    try {
        $embeddingResponse = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers $embeddingHeaders -Body $embeddingPayload -TimeoutSec 30
        
        if ($embeddingResponse.results -and $embeddingResponse.results.Count -gt 0) {
            Write-Host "      🔍 $($embeddingResponse.results.Count) résultats Pinecone trouvés" -ForegroundColor White
            
            # Analyser la pertinence des scores
            $scores = $embeddingResponse.results | ForEach-Object { $_.score }
            $bestScore = ($scores | Measure-Object -Maximum).Maximum
            $avgScore = ($scores | Measure-Object -Average).Average
            $minScore = ($scores | Measure-Object -Minimum).Minimum
            
            Write-Host "      📊 Scores: Max=$([math]::Round($bestScore, 3)), Moy=$([math]::Round($avgScore, 3)), Min=$([math]::Round($minScore, 3))" -ForegroundColor White
            
            # Évaluer la qualité des scores
            $scoreQuality = if ($bestScore -ge 0.8) { "Excellent" } elseif ($bestScore -ge 0.7) { "Bon" } elseif ($bestScore -ge 0.6) { "Moyen" } else { "Faible" }
            Write-Host "      🏆 Qualité des scores: $scoreQuality" -ForegroundColor $(if ($scoreQuality -eq "Excellent") { "Green" } elseif ($scoreQuality -eq "Bon") { "Cyan" } elseif ($scoreQuality -eq "Moyen") { "Yellow" } else { "Red" })
            
            # Vérifier la cohérence des catégories
            $categoryMatches = 0
            $semanticIssues = @()
            
            foreach ($result in $embeddingResponse.results) {
                if ($result.metadata -and $result.metadata.category) {
                    $resultCategory = $result.metadata.category
                    if ($resultCategory -eq $ExpectedCategory) {
                        $categoryMatches++
                    } else {
                        $semanticIssues += "Catégorie '$resultCategory' au lieu de '$ExpectedCategory' (score: $([math]::Round($result.score, 3)))"
                    }
                }
            }
            
            $categoryMatchRate = if ($embeddingResponse.results.Count -gt 0) { [math]::Round(($categoryMatches / $embeddingResponse.results.Count) * 100, 1) } else { 0 }
            Write-Host "      🏷️  Correspondance catégorie: $categoryMatches/$($embeddingResponse.results.Count) ($categoryMatchRate%)" -ForegroundColor $(if ($categoryMatchRate -ge 80) { "Green" } elseif ($categoryMatchRate -ge 60) { "Yellow" } else { "Red" })
            
            # Calculer un score de pertinence global
            $relevanceScore = [math]::Round(($bestScore * 0.4) + ($avgScore * 0.3) + ($categoryMatchRate / 100 * 0.3), 3)
            
            # Identifier les problèmes
            $issues = @()
            if ($bestScore -lt 0.7) { $issues += "Score sémantique trop faible (< 0.7)" }
            if ($categoryMatchRate -lt 60) { $issues += "Faible correspondance de catégorie (< 60%)" }
            if ($avgScore -lt 0.6) { $issues += "Score moyen insuffisant (< 0.6)" }
            
            # Ajouter les problèmes sémantiques spécifiques
            $issues += $semanticIssues
            
            $semanticQuality = if ($relevanceScore -ge 0.8) { "Excellent" } elseif ($relevanceScore -ge 0.6) { "Bon" } elseif ($relevanceScore -ge 0.4) { "Moyen" } else { "Faible" }
            
            Write-Host "      🎯 Score de pertinence global: $relevanceScore ($semanticQuality)" -ForegroundColor $(if ($semanticQuality -eq "Excellent") { "Green" } elseif ($semanticQuality -eq "Bon") { "Cyan" } elseif ($semanticQuality -eq "Moyen") { "Yellow" } else { "Red" })
            
            if ($issues.Count -gt 0) {
                Write-Host "      ⚠️  Problèmes détectés:" -ForegroundColor Yellow
                foreach ($issue in $issues) {
                    Write-Host "         • $issue" -ForegroundColor Yellow
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
            Write-Host "      ❌ Aucun résultat Pinecone trouvé" -ForegroundColor Red
            return @{
                RelevanceScore = 0
                CategoryMatch = $false
                SemanticQuality = "Aucun résultat"
                Issues = @("Aucun embedding trouvé dans Pinecone")
            }
        }
        
    } catch {
        Write-Host "      ❌ Erreur analyse embedding: $($_.Exception.Message)" -ForegroundColor Red
        return @{
            RelevanceScore = 0
            CategoryMatch = $false
            SemanticQuality = "Erreur"
            Issues = @("Erreur accès Pinecone: $($_.Exception.Message)")
        }
    }
}

# Fonction pour vérifier la disponibilité des embeddings dans Pinecone
function Test-EmbeddingAvailability {
    param(
        [string]$ServiceType,
        [string]$SearchQuery
    )
    
    Write-Host "   🔍 Vérification embedding pour: '$SearchQuery'" -ForegroundColor Gray
    
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
            Write-Host "   ✅ Embedding disponible - Meilleur score: $([math]::Round($bestScore, 3))" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ⚠️  Aucun embedding trouvé" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "   ❌ Erreur vérification embedding: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Fonction pour attendre la synchronisation des embeddings
function Wait-EmbeddingSync {
    param(
        [string]$ServiceType,
        [string]$SearchQuery,
        [int]$MaxWaitSeconds = 120
    )
    
    Write-Host "   ⏳ Attente synchronisation embedding Pinecone..." -ForegroundColor Yellow
    
    $startTime = Get-Date
    $elapsedSeconds = 0
    
    while ($elapsedSeconds -lt $MaxWaitSeconds) {
        if (Test-EmbeddingAvailability -ServiceType $ServiceType -SearchQuery $SearchQuery) {
            $elapsedSeconds = [math]::Round((Get-Date - $startTime).TotalSeconds, 0)
            Write-Host "   ✅ Embedding synchronisé en ${elapsedSeconds}s" -ForegroundColor Green
            return $true
        }
        
        Start-Sleep -Seconds 5
        $elapsedSeconds = [math]::Round((Get-Date - $startTime).TotalSeconds, 0)
        
        if ($elapsedSeconds % 15 -eq 0) {
            Write-Host "   ⏳ Encore en attente... (${elapsedSeconds}s écoulées)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "   ⚠️  Timeout - Embedding non synchronisé après ${MaxWaitSeconds}s" -ForegroundColor Red
    return $false
}

# Fonction pour créer un service via l'IA
function Create-ServiceViaIA {
    param(
        [string]$UserNeed,
        [string]$ServiceType
    )
    
    Write-Host "`n🔧 Création de service: $ServiceType" -ForegroundColor Yellow
    Write-Host "Besoin exprimé: '$UserNeed'" -ForegroundColor Gray
    
    $payload = @{
        user_input = $UserNeed
        user_id = 1
        context = "creation_service"
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 60
        
        if ($response.intention -eq "creation_service") {
            Write-Host "✅ Service créé avec succès via IA!" -ForegroundColor Green
            Write-Host "   Intention détectée: $($response.intention)" -ForegroundColor White
            Write-Host "   Titre: $($response.titre.valeur)" -ForegroundColor White
            Write-Host "   Catégorie: $($response.category.valeur)" -ForegroundColor White
            Write-Host "   Tokens consommés: $($response.tokens_consumed)" -ForegroundColor Cyan
            
            # Attendre la synchronisation des embeddings
            Write-Host "   🕐 Attente synchronisation Pinecone..." -ForegroundColor Yellow
            $syncSuccess = Wait-EmbeddingSync -ServiceType $ServiceType -SearchQuery $UserNeed
            
            if ($syncSuccess) {
                Write-Host "   ✅ Service prêt pour les tests de recherche" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Service créé mais embedding non synchronisé" -ForegroundColor Yellow
            }
            
            return @{
                Response = $response
                EmbeddingSynced = $syncSuccess
            }
        } else {
            Write-Host "❌ Intention incorrecte détectée: $($response.intention)" -ForegroundColor Red
            return $null
        }
    } catch {
        Write-Host "❌ Erreur création service: $($_.Exception.Message)" -ForegroundColor Red
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
    
    Write-Host "`n🔍 Test de recherche: '$SearchQuery'" -ForegroundColor Blue
    Write-Host "   Catégorie attendue: $ExpectedCategory" -ForegroundColor Gray
    
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
        
        Write-Host "   ⏱️  Temps de réponse: ${duration}ms" -ForegroundColor Cyan
        Write-Host "   🎯 Intention détectée: $($response.intention)" -ForegroundColor White
        Write-Host "   🧠 Modèle IA utilisé: $($response.ia_model_used)" -ForegroundColor White
        Write-Host "   💰 Tokens consommés: $($response.tokens_consumed)" -ForegroundColor Yellow
        
        # Analyser les résultats
        if ($response.resultats -and $response.resultats.detail -ne "Not Found") {
            Write-Host "   ✅ Résultats trouvés" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Aucun résultat trouvé (Not Found)" -ForegroundColor Yellow
        }
        
        # ANALYSE DE LA PERTINENCE SÉMANTIQUE
        $relevanceAnalysis = Analyze-SemanticRelevance -SearchQuery $SearchQuery -ExpectedCategory $ExpectedCategory -SearchResults $response.resultats -ServiceType $ServiceType
        
        return @{
            Response = $response
            RelevanceAnalysis = $relevanceAnalysis
            Duration = $duration
        }
        
    } catch {
        Write-Host "   ❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Liste des services à créer avec des besoins naturels
$servicesToCreate = @(
    @{
        Type = "Mécanicien automobile"
        Need = "J'ai besoin d'un mécanicien pour réparer ma voiture qui ne démarre plus"
    },
    @{
        Type = "Plombier"
        Need = "Je cherche un plombier pour réparer une fuite d'eau dans ma salle de bain"
    },
    @{
        Type = "Électricien"
        Need = "J'ai besoin d'un électricien pour installer des prises électriques dans ma maison"
    },
    @{
        Type = "Couturier"
        Need = "Je cherche un couturier pour retoucher mes vêtements"
    },
    @{
        Type = "Coiffeur"
        Need = "J'ai besoin d'un coiffeur pour une coupe de cheveux professionnelle"
    },
    @{
        Type = "Restaurant"
        Need = "Je cherche un restaurant qui livre à domicile dans mon quartier"
    },
    @{
        Type = "Taxi"
        Need = "J'ai besoin d'un taxi pour aller à l'aéroport demain matin"
    },
    @{
        Type = "Nettoyage"
        Need = "Je cherche quelqu'un pour nettoyer mon appartement après déménagement"
    },
    @{
        Type = "Jardinier"
        Need = "J'ai besoin d'un jardinier pour entretenir mon jardin et tailler les haies"
    },
    @{
        Type = "Peintre"
        Need = "Je cherche un peintre pour repeindre les murs de mon salon"
    },
    @{
        Type = "Déménageur"
        Need = "J'ai besoin de déménageurs pour transporter mes meubles vers ma nouvelle maison"
    },
    @{
        Type = "Informaticien"
        Need = "Je cherche un informaticien pour réparer mon ordinateur qui plante"
    },
    @{
        Type = "Photographe"
        Need = "J'ai besoin d'un photographe pour mon mariage le mois prochain"
    },
    @{
        Type = "Traducteur"
        Need = "Je cherche un traducteur français-anglais pour traduire mes documents"
    },
    @{
        Type = "Avocat"
        Need = "J'ai besoin d'un avocat pour un problème de contrat de travail"
    },
    @{
        Type = "Médecin"
        Need = "Je cherche un médecin généraliste qui fait des visites à domicile"
    },
    @{
        Type = "Professeur"
        Need = "J'ai besoin d'un professeur de mathématiques pour mes cours particuliers"
    },
    @{
        Type = "Musique"
        Need = "Je cherche un musicien pour animer mon événement d'entreprise"
    },
    @{
        Type = "Sport"
        Need = "J'ai besoin d'un coach sportif personnel pour perdre du poids"
    },
    @{
        Type = "Beauté"
        Need = "Je cherche une esthéticienne pour un soin du visage professionnel"
    }
)

# Créer tous les services
Write-Host "`n🏗️  PHASE 1: CRÉATION DES SERVICES VIA IA" -ForegroundColor Magenta
Write-Host "=" * 50 -ForegroundColor Magenta
Write-Host "⚠️  Cette phase inclut des délais pour la synchronisation Pinecone" -ForegroundColor Yellow

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
    
    # Pause entre les créations pour éviter la surcharge et laisser le temps aux embeddings
    Write-Host "   ⏸️  Pause de 10 secondes pour laisser le temps aux embeddings..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
}

Write-Host "`n📊 RÉSUMÉ CRÉATION:" -ForegroundColor Green
Write-Host "   ✅ Services créés avec succès: $successCount" -ForegroundColor Green
Write-Host "   🔄 Embeddings synchronisés: $embeddingSyncCount" -ForegroundColor Cyan
Write-Host "   ❌ Échecs: $failureCount" -ForegroundColor Red
Write-Host "   📝 Total tentatives: $($servicesToCreate.Count)" -ForegroundColor White

# PHASE 2: TESTS DE RECHERCHE AVEC ANALYSE DE PERTINENCE
Write-Host "`n🔍 PHASE 2: TESTS DE RECHERCHE AVEC ANALYSE DE PERTINENCE" -ForegroundColor Magenta
Write-Host "=" * 70 -ForegroundColor Magenta
Write-Host "⚠️  Seuls les services avec embeddings synchronisés seront testés" -ForegroundColor Yellow
Write-Host "🎯 Analyse approfondie de la pertinence des matching sémantiques" -ForegroundColor Magenta

$servicesReadyForSearch = $createdServices | Where-Object { $_.EmbeddingSynced }
$servicesNotReady = $createdServices | Where-Object { -not $_.EmbeddingSynced }

if ($servicesNotReady.Count -gt 0) {
    Write-Host "`n⚠️  SERVICES NON PRÊTS POUR LA RECHERCHE:" -ForegroundColor Yellow
    foreach ($service in $servicesNotReady) {
        Write-Host "   ❌ $($service.Type) - Embedding non synchronisé" -ForegroundColor Red
    }
}

if ($servicesReadyForSearch.Count -eq 0) {
    Write-Host "`n❌ Aucun service prêt pour les tests de recherche!" -ForegroundColor Red
    Write-Host "   Vérifiez la configuration Pinecone et les délais de synchronisation" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ SERVICES PRÊTS POUR LA RECHERCHE: $($servicesReadyForSearch.Count)" -ForegroundColor Green

# Cas de recherche pour chaque service prêt
$searchTests = @()

foreach ($service in $servicesReadyForSearch) {
    $serviceType = $service.Type
    $searchQueries = @(
        "Je cherche un $serviceType",
        "Besoin urgent de $serviceType",
        "Quelqu'un connaît un bon $serviceType ?",
        "Recommandation $serviceType",
        "Prix $serviceType"
    )
    
    foreach ($query in $searchQueries) {
        $searchTests += @{
            ServiceType = $serviceType
            Query = $query
            ExpectedCategory = $service.Response.category.valeur
        }
    }
}

Write-Host "`n🧪 Exécution de $($searchTests.Count) tests de recherche avec analyse de pertinence..." -ForegroundColor Yellow

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
        
        # Statistiques de qualité sémantique
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

# ANALYSE DES RÉSULTATS AVEC PERTINENCE SÉMANTIQUE
Write-Host "`n📈 ANALYSE DES RÉSULTATS AVEC PERTINENCE SÉMANTIQUE" -ForegroundColor Magenta
Write-Host "=" * 70 -ForegroundColor Magenta

$successfulSearches = $searchResults | Where-Object { $_.Success }
$failedSearches = $searchResults | Where-Object { -not $_.Success }

Write-Host "🔍 RECHERCHES:" -ForegroundColor White
Write-Host "   ✅ Réussies: $($successfulSearches.Count)" -ForegroundColor Green
Write-Host "   ❌ Échouées: $($failedSearches.Count)" -ForegroundColor Red
Write-Host "   📊 Taux de succès: $([math]::Round(($successfulSearches.Count / $searchResults.Count) * 100, 2))%" -ForegroundColor Cyan

Write-Host "`n💰 CONSOMMATION TOKENS:" -ForegroundColor White
Write-Host "   🧠 Total tokens consommés: $totalTokens" -ForegroundColor Yellow
Write-Host "   📊 Moyenne par recherche: $([math]::Round($totalTokens / $searchResults.Count, 2))" -ForegroundColor Yellow

# ANALYSE DE LA PERTINENCE SÉMANTIQUE
Write-Host "`n🎯 ANALYSE DE LA PERTINENCE SÉMANTIQUE:" -ForegroundColor Magenta
Write-Host "=" * 50 -ForegroundColor Magenta

if ($relevanceScores.Count -gt 0) {
    $avgRelevance = ($relevanceScores | Measure-Object -Average).Average
    $maxRelevance = ($relevanceScores | Measure-Object -Maximum).Maximum
    $minRelevance = ($relevanceScores | Measure-Object -Minimum).Minimum
    
    Write-Host "📊 SCORES DE PERTINENCE:" -ForegroundColor White
    Write-Host "   🏆 Score moyen: $([math]::Round($avgRelevance, 3))" -ForegroundColor Cyan
    Write-Host "   🥇 Score maximum: $([math]::Round($maxRelevance, 3))" -ForegroundColor Green
    Write-Host "   🥉 Score minimum: $([math]::Round($minRelevance, 3))" -ForegroundColor Yellow
    
    # Distribution de la qualité sémantique
    Write-Host "`n🏅 DISTRIBUTION QUALITÉ SÉMANTIQUE:" -ForegroundColor White
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
    
    # Évaluation globale
    $globalQuality = if ($avgRelevance -ge 0.8) { "EXCELLENT" } elseif ($avgRelevance -ge 0.6) { "BON" } elseif ($avgRelevance -ge 0.4) { "MOYEN" } else { "FAIBLE" }
    $globalColor = switch ($globalQuality) {
        "EXCELLENT" { "Green" }
        "BON" { "Cyan" }
        "MOYEN" { "Yellow" }
        default { "Red" }
    }
    
    Write-Host "`n🌟 QUALITÉ GLOBALE DU MATCHING SÉMANTIQUE: $globalQuality" -ForegroundColor $globalColor
    Write-Host "   Score moyen: $([math]::Round($avgRelevance, 3))" -ForegroundColor White
    
} else {
    Write-Host "   ⚠️  Aucun score de pertinence disponible" -ForegroundColor Yellow
}

# Analyser les problèmes détectés
Write-Host "`n🚨 PROBLÈMES DÉTECTÉS:" -ForegroundColor Red
Write-Host "=" * 30 -ForegroundColor Red

$problems = @()

# Vérifier les recherches qui ont échoué
foreach ($failed in $failedSearches) {
    $problems += "❌ Recherche échouée: '$($failed.Test.Query)' pour $($failed.Test.ServiceType)"
}

# Vérifier les intentions incorrectes
$incorrectIntentions = $searchResults | Where-Object { 
    $_.Success -and $_.Result.intention -ne "recherche_besoin" 
}

foreach ($incorrect in $incorrectIntentions) {
    $problems += "⚠️  Intention incorrecte: '$($incorrect.Result.intention)' au lieu de 'recherche_besoin' pour '$($incorrect.Test.Query)'"
}

# Vérifier les temps de réponse lents
$slowResponses = $searchResults | Where-Object { 
    $_.Success -and $_.Duration -gt 10000 
}

foreach ($slow in $slowResponses) {
    $problems += "🐌 Réponse lente: ${$slow.Duration}ms pour '$($slow.Test.Query)'"
}

# Vérifier les problèmes d'embeddings
if ($servicesNotReady.Count -gt 0) {
    $problems += "🔴 $($servicesNotReady.Count) services avec embeddings non synchronisés"
}

# Vérifier les problèmes de pertinence sémantique
$lowRelevanceSearches = $searchResults | Where-Object { 
    $_.Success -and $_.RelevanceAnalysis -and $_.RelevanceAnalysis.RelevanceScore -lt 0.5 
}

if ($lowRelevanceSearches.Count -gt 0) {
    $problems += "🎯 $($lowRelevanceSearches.Count) recherches avec faible pertinence sémantique (< 0.5)"
}

if ($problems.Count -eq 0) {
    Write-Host "   ✅ Aucun problème détecté!" -ForegroundColor Green
} else {
    foreach ($problem in $problems) {
        Write-Host "   $problem" -ForegroundColor Red
    }
}

# Recommandations
Write-Host "`n💡 RECOMMANDATIONS:" -ForegroundColor Cyan
Write-Host "=" * 30 -ForegroundColor Cyan

if ($failedSearches.Count -gt 0) {
    Write-Host "   🔧 Vérifier la gestion d'erreur dans le service de recherche" -ForegroundColor White
}

if ($incorrectIntentions.Count -gt 0) {
    Write-Host "   🧠 Améliorer la détection d'intention pour les recherches" -ForegroundColor White
}

if ($slowResponses.Count -gt 0) {
    Write-Host "   ⚡ Optimiser les performances des recherches IA" -ForegroundColor White
}

if ($totalTokens -gt 50000) {
    Write-Host "   💰 Optimiser la consommation de tokens pour réduire les coûts" -ForegroundColor White
}

if ($servicesNotReady.Count -gt 0) {
    Write-Host "   🔄 Augmenter les délais de synchronisation Pinecone ou vérifier la configuration" -ForegroundColor White
}

if ($lowRelevanceSearches.Count -gt 0) {
    Write-Host "   🎯 Améliorer la qualité des embeddings et le matching sémantique" -ForegroundColor White
}

if ($avgRelevance -lt 0.6) {
    Write-Host "   🔍 Revoir les seuils de matching et la qualité des embeddings" -ForegroundColor White
}

Write-Host "`n🎯 TEST TERMINÉ!" -ForegroundColor Green
Write-Host "Services créés: $successCount" -ForegroundColor White
Write-Host "Embeddings synchronisés: $embeddingSyncCount" -ForegroundColor Cyan
Write-Host "Tests de recherche: $($searchResults.Count)" -ForegroundColor White
Write-Host "Taux de succès: $([math]::Round(($successfulSearches.Count / $searchResults.Count) * 100, 2))%" -ForegroundColor White
Write-Host "Pertinence sémantique moyenne: $([math]::Round($avgRelevance, 3))" -ForegroundColor Magenta 