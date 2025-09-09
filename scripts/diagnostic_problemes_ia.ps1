# Script de diagnostic des problèmes IA
# Ce script analyse spécifiquement les problèmes détectés dans le système

Write-Host "🔍 DIAGNOSTIC PROBLÈMES IA" -ForegroundColor Red
Write-Host "=" * 50 -ForegroundColor Red
Write-Host "Analyse approfondie des problèmes détectés" -ForegroundColor White

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

# 1. Diagnostic de la détection d'intention
Write-Host "`n🧠 DIAGNOSTIC 1: Détection d'intention" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

$intentionTests = @(
    @{ Input = "Je veux créer un service"; Expected = "creation_service" },
    @{ Input = "Je cherche un mécanicien"; Expected = "recherche_besoin" },
    @{ Input = "Modifier mon service"; Expected = "mise_a_jour_service" },
    @{ Input = "Supprimer mon service"; Expected = "suppression_service" },
    @{ Input = "Bonjour, comment ça va?"; Expected = "assistance_generale" }
)

foreach ($test in $intentionTests) {
    $payload = @{
        user_input = $test.Input
        user_id = 1
        context = "test"
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
        
        $correct = $response.intention -eq $test.Expected
        $status = if ($correct) { "✅" } else { "❌" }
        $color = if ($correct) { "Green" } else { "Red" }
        
        Write-Host "$status '$($test.Input)' -> $($response.intention) (attendu: $($test.Expected))" -ForegroundColor $color
        
    } catch {
        Write-Host "❌ '$($test.Input)' -> Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
}

# 2. Diagnostic des performances
Write-Host "`n⚡ DIAGNOSTIC 2: Performances" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

$performanceTests = @(
    "mécanicien",
    "plombier urgent",
    "électricien installation",
    "coiffeur professionnel",
    "restaurant livraison"
)

$performanceResults = @()

foreach ($query in $performanceTests) {
    $payload = @{
        user_input = $query
        user_id = 1
        context = "recherche_besoin"
    } | ConvertTo-Json -Depth 10
    
    try {
        $startTime = Get-Date
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $performanceResults += @{
            Query = $query
            Duration = $duration
            Tokens = $response.tokens_consumed
            Intention = $response.intention
            Success = $true
        }
        
        $status = if ($duration -lt 5000) { "✅" } elseif ($duration -lt 10000) { "⚠️" } else { "❌" }
        Write-Host "$status '$query': ${duration}ms, $($response.tokens_consumed) tokens" -ForegroundColor White
        
    } catch {
        $performanceResults += @{
            Query = $query
            Duration = 0
            Tokens = 0
            Intention = "error"
            Success = $false
        }
        Write-Host "❌ '$query': Échec" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

# Analyse des performances
$successfulTests = $performanceResults | Where-Object { $_.Success }
if ($successfulTests.Count -gt 0) {
    $avgDuration = ($successfulTests | Measure-Object Duration -Average).Average
    $avgTokens = ($successfulTests | Measure-Object Tokens -Average).Average
    
    Write-Host "`n📊 MÉTRIQUES PERFORMANCE:" -ForegroundColor White
    Write-Host "   Temps moyen: $([math]::Round($avgDuration, 0))ms" -ForegroundColor White
    Write-Host "   Tokens moyen: $([math]::Round($avgTokens, 0))" -ForegroundColor White
    
    $slowQueries = $successfulTests | Where-Object { $_.Duration -gt 10000 }
    if ($slowQueries.Count -gt 0) {
        Write-Host "   🐌 Requêtes lentes (>10s): $($slowQueries.Count)" -ForegroundColor Yellow
    }
}

# 3. Diagnostic des embeddings
Write-Host "`n🔗 DIAGNOSTIC 3: Système d'embeddings" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

# Test de connectivité Pinecone
Write-Host "   🔍 Test connectivité Pinecone..." -ForegroundColor Gray

try {
    $pineconeTest = @{
        query = "test"
        type_donnee = "texte"
        top_k = 1
        active = $true
    } | ConvertTo-Json -Depth 10
    
    $pineconeResponse = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers $embeddingHeaders -Body $pineconeTest -TimeoutSec 30
    
    if ($pineconeResponse.results) {
        Write-Host "   ✅ Pinecone accessible - $($pineconeResponse.results.Count) résultats" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Pinecone accessible mais aucun résultat" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "   ❌ Pinecone inaccessible: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Diagnostic des erreurs
Write-Host "`n🚨 DIAGNOSTIC 4: Gestion des erreurs" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

$errorTests = @(
    @{ Input = $null; Description = "Input null" },
    @{ Input = ""; Description = "Input vide" },
    @{ Input = "a"; Description = "Input trop court" },
    @{ Input = "x" * 1000; Description = "Input trop long" },
    @{ Input = "test@test.com"; Description = "Email au lieu de besoin" }
)

foreach ($test in $errorTests) {
    $payload = @{
        user_input = $test.Input
        user_id = 1
        context = "test"
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 15
        
        if ($response.intention -eq "assistance_generale") {
            Write-Host "   ✅ '$($test.Description)': Géré comme assistance générale" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  '$($test.Description)': Intention inattendue '$($response.intention)'" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "   ❌ '$($test.Description)': Erreur HTTP - $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

# 5. Diagnostic de la cohérence
Write-Host "`n🔄 DIAGNOSTIC 5: Cohérence des réponses" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

$coherenceTests = @(
    "mécanicien",
    "mécanicien automobile",
    "mécanicien voiture",
    "réparation voiture"
)

$coherenceResults = @()

foreach ($query in $coherenceTests) {
    $payload = @{
        user_input = $query
        user_id = 1
        context = "recherche_besoin"
    } | ConvertTo-Json -Depth 10
    
    try {
        $response = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
        
        $coherenceResults += @{
            Query = $query
            Intention = $response.intention
            Category = if ($response.category) { $response.category.valeur } else { "N/A" }
            Tokens = $response.tokens_consumed
        }
        
        Write-Host "   '$query' -> $($response.intention) | $($response.category.valeur) | $($response.tokens_consumed) tokens" -ForegroundColor White
        
    } catch {
        Write-Host "   ❌ '$query': Erreur" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

# Vérifier la cohérence
$sameIntentions = ($coherenceResults | Group-Object Intention).Count
if ($sameIntentions -eq 1) {
    Write-Host "   ✅ Cohérence: Toutes les requêtes ont la même intention" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Incohérence: $sameIntentions intentions différentes détectées" -ForegroundColor Yellow
}

# 6. Recommandations
Write-Host "`n💡 RECOMMANDATIONS" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

# Analyser les problèmes détectés
$problems = @()

# Problèmes de performance
$slowCount = ($performanceResults | Where-Object { $_.Success -and $_.Duration -gt 10000 }).Count
if ($slowCount -gt 0) {
    $problems += "🐌 $slowCount requêtes lentes (>10s)"
}

# Problèmes d'intention
$incorrectIntentions = ($intentionTests | Where-Object { 
    $test = $_
    $result = $performanceResults | Where-Object { $_.Query -eq $test.Input }
    $result -and $result.Intention -ne $test.Expected
}).Count

if ($incorrectIntentions -gt 0) {
    $problems += "🧠 $incorrectIntentions intentions incorrectes détectées"
}

# Problèmes de cohérence
if ($sameIntentions -gt 1) {
    $problems += "🔄 Incohérence dans la détection d'intention"
}

# Problèmes d'embeddings
try {
    $embeddingTest = Invoke-RestMethod -Uri "$EMBEDDING_API_URL/search_embedding_pinecone" -Method POST -Headers $embeddingHeaders -Body (@{ query = "test"; type_donnee = "texte"; top_k = 1; active = $true } | ConvertTo-Json) -TimeoutSec 10
    if (-not $embeddingTest.results -or $embeddingTest.results.Count -eq 0) {
        $problems += "🔗 Aucun embedding trouvé dans Pinecone"
    }
} catch {
    $problems += "🔗 Système d'embeddings inaccessible"
}

if ($problems.Count -eq 0) {
    Write-Host "   ✅ Aucun problème majeur détecté" -ForegroundColor Green
} else {
    Write-Host "   🚨 Problèmes détectés:" -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host "      $problem" -ForegroundColor Red
    }
}

Write-Host "`n🎯 DIAGNOSTIC TERMINÉ!" -ForegroundColor Green
Write-Host "Consultez les résultats ci-dessus pour identifier les problèmes" -ForegroundColor White 