# Script de debug direct du serveur backend
Write-Host "Debug direct du serveur backend" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5NzAzNSwiaWF0IjoxNzU2NjMxMjQyLCJleHAiOjE3NTY3MTc2NDJ9.lRG6dFYcNdP170gqFyHyp6AJn95iwukmz-vvXFgLNHw"

Write-Host "`n1. Verification de la sante du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/healthz" -Method Get -TimeoutSec 5
    Write-Host "   Serveur en ligne: $response" -ForegroundColor Green
} catch {
    Write-Host "   Serveur inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Test de l'API /api/user/me avec analyse detaillee..." -ForegroundColor Yellow
Write-Host "   Nous allons analyser la reponse complete pour identifier l'erreur" -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Contenu: $($response | ConvertTo-Json)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERREUR DETECTEE !" -ForegroundColor Red
    Write-Host "   Type d'erreur: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "`n   ANALYSE DE L'ERREUR HTTP:" -ForegroundColor Yellow
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "   Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    }
}

Write-Host "`n3. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Solde: $($response.tokens_balance)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== DEBUG TERMINE ===" -ForegroundColor Cyan 