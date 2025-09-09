# Test simple avec le token existant
Write-Host "TEST SIMPLE AVEC TOKEN EXISTANT" -ForegroundColor Green

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
    Write-Host "Envoi de la requete..." -ForegroundColor Gray
    $createResponse = Invoke-RestMethod -Uri "$BACKEND_API_URL/api/yukpo" -Method POST -Headers $headers -Body $createPayload -TimeoutSec 60
    
    Write-Host "SUCCES!" -ForegroundColor Green
    Write-Host "Intention: $($createResponse.intention)" -ForegroundColor White
    Write-Host "Titre: $($createResponse.titre.valeur)" -ForegroundColor White
    Write-Host "Categorie: $($createResponse.category.valeur)" -ForegroundColor White
    Write-Host "Tokens: $($createResponse.tokens_consumed)" -ForegroundColor Cyan
    
} catch {
    Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`nTest termine!" -ForegroundColor Green 