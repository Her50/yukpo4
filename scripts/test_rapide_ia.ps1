# Script de test rapide pour tester les fonctionnalités IA de base
# Ce script teste rapidement la création et la recherche sans attendre la synchronisation complète

Write-Host "⚡ TEST RAPIDE IA - FONCTIONNALITÉS DE BASE" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Test rapide des fonctionnalités IA sans synchronisation complète Pinecone" -ForegroundColor White

# Configuration
$BACKEND_API_URL = "http://localhost:3001"
$JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxODAwMCwiaWF0IjoxNzU2MzgyOTk2LCJleHAiOjE3NTY0NjkzOTZ9.3z2QKy4AuuxU2p1Sp5iOe7zHX7nISsY0mxEfGSLQ8M8"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT_TOKEN"
}

# Test 1: Création de service simple
Write-Host "`n🔧 TEST 1: Création de service simple" -ForegroundColor Yellow
Write-Host "Besoin: 'Je cherche un mécanicien pour ma voiture'" -ForegroundColor Gray

$createPayload = @{
    user_input = "Je cherche un mécanicien pour ma voiture"
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    $createResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $createPayload -TimeoutSec 30
    
    Write-Host "✅ Service créé!" -ForegroundColor Green
    Write-Host "   Intention: $($createResponse.intention)" -ForegroundColor White
    Write-Host "   Titre: $($createResponse.titre.valeur)" -ForegroundColor White
    Write-Host "   Catégorie: $($createResponse.category.valeur)" -ForegroundColor White
    Write-Host "   Tokens: $($createResponse.tokens_consumed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Erreur création: $($_.Exception.Message)" -ForegroundColor Red
}

# Pause courte
Start-Sleep -Seconds 3

# Test 2: Recherche simple
Write-Host "`n🔍 TEST 2: Recherche simple" -ForegroundColor Yellow
Write-Host "Recherche: 'Je cherche un mécanicien'" -ForegroundColor Gray

$searchPayload = @{
    user_input = "Je cherche un mécanicien"
    user_id = 1
    context = "recherche_besoin"
} | ConvertTo-Json -Depth 10

try {
    $startTime = Get-Date
    $searchResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $searchPayload -TimeoutSec 30
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "✅ Recherche réussie!" -ForegroundColor Green
    Write-Host "   Intention: $($searchResponse.intention)" -ForegroundColor White
    Write-Host "   Temps: ${duration}ms" -ForegroundColor Cyan
    Write-Host "   Tokens: $($searchResponse.tokens_consumed)" -ForegroundColor Yellow
    Write-Host "   Modèle: $($searchResponse.ia_model_used)" -ForegroundColor White
    
    if ($searchResponse.resultats) {
        Write-Host "   Résultats: $($searchResponse.resultats.detail)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Création de service complexe
Write-Host "`n🏗️  TEST 3: Création de service complexe" -ForegroundColor Yellow
Write-Host "Besoin: 'J\'ai besoin d\'un plombier professionnel pour réparer une fuite d\'eau urgente dans ma salle de bain, avec devis gratuit'" -ForegroundColor Gray

$complexPayload = @{
    user_input = "J'ai besoin d'un plombier professionnel pour réparer une fuite d'eau urgente dans ma salle de bain, avec devis gratuit"
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    $complexResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $complexPayload -TimeoutSec 30
    
    Write-Host "✅ Service complexe créé!" -ForegroundColor Green
    Write-Host "   Intention: $($complexResponse.intention)" -ForegroundColor White
    Write-Host "   Titre: $($complexResponse.titre.valeur)" -ForegroundColor White
    Write-Host "   Description: $($complexResponse.description.valeur)" -ForegroundColor White
    Write-Host "   Catégorie: $($complexResponse.category.valeur)" -ForegroundColor White
    Write-Host "   Tokens: $($complexResponse.tokens_consumed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Erreur création complexe: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Recherche avec contexte
Write-Host "`n🎯 TEST 4: Recherche avec contexte" -ForegroundColor Yellow
Write-Host "Recherche: 'Urgent! Fuite d\'eau salle de bain'" -ForegroundColor Gray

$contextPayload = @{
    user_input = "Urgent! Fuite d'eau salle de bain"
    user_id = 1
    context = "recherche_besoin"
} | ConvertTo-Json -Depth 10

try {
    $startTime = Get-Date
    $contextResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $contextPayload -TimeoutSec 30
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "✅ Recherche contextuelle réussie!" -ForegroundColor Green
    Write-Host "   Intention: $($contextResponse.intention)" -ForegroundColor White
    Write-Host "   Temps: ${duration}ms" -ForegroundColor Cyan
    Write-Host "   Tokens: $($contextResponse.tokens_consumed)" -ForegroundColor Yellow
    
    if ($contextResponse.reponse_intelligente) {
        Write-Host "   Réponse IA: $($contextResponse.reponse_intelligente.valeur)" -ForegroundColor White
    }
    
} catch {
    Write-Host "❌ Erreur recherche contextuelle: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Test de performance
Write-Host "`n⚡ TEST 5: Test de performance" -ForegroundColor Yellow
Write-Host "5 recherches rapides consécutives..." -ForegroundColor Gray

$performanceQueries = @(
    "mécanicien",
    "plombier",
    "électricien",
    "coiffeur",
    "restaurant"
)

$totalTime = 0
$totalTokens = 0
$successCount = 0

foreach ($query in $performanceQueries) {
    $perfPayload = @{
        user_input = $query
        user_id = 1
        context = "recherche_besoin"
    } | ConvertTo-Json -Depth 10
    
    try {
        $startTime = Get-Date
        $perfResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $perfPayload -TimeoutSec 15
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $totalTime += $duration
        $totalTokens += $perfResponse.tokens_consumed
        $successCount++
        
        Write-Host "   ✅ '$query': ${duration}ms, $($perfResponse.tokens_consumed) tokens" -ForegroundColor Green
        
    } catch {
        Write-Host "   ❌ '$query': Échec" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`n📊 RÉSUMÉ PERFORMANCE:" -ForegroundColor Cyan
Write-Host "   ✅ Recherches réussies: $successCount/$($performanceQueries.Count)" -ForegroundColor White
Write-Host "   ⏱️  Temps total: ${totalTime}ms" -ForegroundColor White
Write-Host "   📊 Temps moyen: $([math]::Round($totalTime / $successCount, 0))ms" -ForegroundColor White
Write-Host "   🧠 Tokens totaux: $totalTokens" -ForegroundColor White
Write-Host "   📊 Tokens moyen: $([math]::Round($totalTokens / $successCount, 0))" -ForegroundColor White

# Test 6: Vérification des erreurs
Write-Host "`n🚨 TEST 6: Gestion des erreurs" -ForegroundColor Yellow
Write-Host "Test avec input invalide..." -ForegroundColor Gray

$invalidPayload = @{
    user_input = ""
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    $invalidResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $invalidPayload -TimeoutSec 15
    Write-Host "   ⚠️  Input vide accepté (peut-être géré par l'IA)" -ForegroundColor Yellow
} catch {
    Write-Host "   ✅ Erreur correctement gérée: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host "`n🎯 TEST RAPIDE TERMINÉ!" -ForegroundColor Green
Write-Host "Vérifiez les résultats ci-dessus pour identifier les problèmes potentiels" -ForegroundColor White 