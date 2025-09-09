# Test basique de votre systeme IA
# Version simplifiee et fonctionnelle

Write-Host "TEST BASIQUE DU SYSTEME IA" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Configuration
$BACKEND_API_URL = "http://localhost:3001"
$JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMxODAwMCwiaWF0IjoxNzU2MzgyOTk2LCJleHAiOjE3NTY0NjkzOTZ9.3z2QKy4AuuxU2p1Sp5iOe7zHX7nISsY0mxEfGSLQ8M8"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT_TOKEN"
}

# Test 1: Creation de service
Write-Host "`nTest 1: Creation de service mecanicien" -ForegroundColor Yellow

$createPayload = @{
    user_input = "Je cherche un mecanicien pour reparer ma voiture"
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de creation..." -ForegroundColor Gray
    $createResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $createPayload -TimeoutSec 30
    
    Write-Host "Service cree avec succes!" -ForegroundColor Green
    Write-Host "Intention detectee: $($createResponse.intention)" -ForegroundColor White
    Write-Host "Titre: $($createResponse.titre.valeur)" -ForegroundColor White
    Write-Host "Categorie: $($createResponse.category.valeur)" -ForegroundColor White
    Write-Host "Tokens consommes: $($createResponse.tokens_consumed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "Erreur creation service: $($_.Exception.Message)" -ForegroundColor Red
}

# Pause pour laisser le temps aux embeddings
Write-Host "`nPause de 10 secondes pour la synchronisation..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Test 2: Recherche de service
Write-Host "`nTest 2: Recherche de mecanicien" -ForegroundColor Yellow

$searchPayload = @{
    user_input = "Je cherche un mecanicien"
    user_id = 1
    context = "recherche_besoin"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de recherche..." -ForegroundColor Gray
    $startTime = Get-Date
    $searchResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $searchPayload -TimeoutSec 30
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "Recherche reussie!" -ForegroundColor Green
    Write-Host "Intention detectee: $($searchResponse.intention)" -ForegroundColor White
    Write-Host "Temps de reponse: ${duration}ms" -ForegroundColor Cyan
    Write-Host "Modele IA utilise: $($searchResponse.ia_model_used)" -ForegroundColor White
    Write-Host "Tokens consommes: $($searchResponse.tokens_consumed)" -ForegroundColor Yellow
    
    if ($searchResponse.resultats) {
        Write-Host "Resultats: $($searchResponse.resultats.detail)" -ForegroundColor White
    }
    
} catch {
    Write-Host "Erreur recherche: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Creation d'un autre service
Write-Host "`nTest 3: Creation de service plombier" -ForegroundColor Yellow

$createPayload2 = @{
    user_input = "J'ai besoin d'un plombier pour reparer une fuite d'eau"
    user_id = 1
    context = "creation_service"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de creation..." -ForegroundColor Gray
    $createResponse2 = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $createPayload2 -TimeoutSec 30
    
    Write-Host "Service plombier cree avec succes!" -ForegroundColor Green
    Write-Host "Intention detectee: $($createResponse2.intention)" -ForegroundColor White
    Write-Host "Titre: $($createResponse2.titre.valeur)" -ForegroundColor White
    Write-Host "Categorie: $($createResponse2.category.valeur)" -ForegroundColor White
    Write-Host "Tokens consommes: $($createResponse2.tokens_consumed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "Erreur creation service plombier: $($_.Exception.Message)" -ForegroundColor Red
}

# Pause pour la synchronisation
Write-Host "`nPause de 10 secondes pour la synchronisation..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Test 4: Recherche de plombier
Write-Host "`nTest 4: Recherche de plombier" -ForegroundColor Yellow

$searchPayload2 = @{
    user_input = "Je cherche un plombier urgent"
    user_id = 1
    context = "recherche_besoin"
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Envoi de la requete de recherche..." -ForegroundColor Gray
    $startTime = Get-Date
    $searchResponse2 = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $searchPayload2 -TimeoutSec 30
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "Recherche plombier reussie!" -ForegroundColor Green
    Write-Host "Intention detectee: $($searchResponse2.intention)" -ForegroundColor White
    Write-Host "Temps de reponse: ${duration}ms" -ForegroundColor Cyan
    Write-Host "Modele IA utilise: $($searchResponse2.ia_model_used)" -ForegroundColor White
    Write-Host "Tokens consommes: $($searchResponse2.tokens_consumed)" -ForegroundColor Yellow
    
    if ($searchResponse2.resultats) {
        Write-Host "Resultats: $($searchResponse2.resultats.detail)" -ForegroundColor White
    }
    
} catch {
    Write-Host "Erreur recherche plombier: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest basique termine!" -ForegroundColor Green
Write-Host "Verifiez les resultats ci-dessus" -ForegroundColor White 