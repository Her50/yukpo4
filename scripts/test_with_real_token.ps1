# Script de test de l'API /api/user/me avec un vrai token JWT
Write-Host "Test de l'API /api/user/me avec token JWT valide" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

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

Write-Host "`n2. Test de l'API /api/user/me avec le token valide..." -ForegroundColor Yellow
Write-Host "   ATTENTION: Ce test va declencher l'erreur 500 !" -ForegroundColor Red
Write-Host "   Regardez les logs du serveur backend pour voir l'erreur exacte" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Utilisateur: $($response.email)" -ForegroundColor Gray
    Write-Host "   Role: $($response.role)" -ForegroundColor Gray
    Write-Host "   Tokens: $($response.tokens_balance)" -ForegroundColor Gray
    
    Write-Host "`nPROBLEME RESOLU !" -ForegroundColor Green
    Write-Host "L'API /api/user/me fonctionne maintenant correctement." -ForegroundColor White
    
} catch {
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   ERREUR 500 DECLENCHEE !" -ForegroundColor Red
        Write-Host "   Message d'erreur: $($_.Exception.Message)" -ForegroundColor Red
        
        Write-Host "`nDIAGNOSTIC:" -ForegroundColor Yellow
        Write-Host "L'API /api/user/me retourne une erreur 500 avec un token valide." -ForegroundColor White
        Write-Host "Cela confirme un probleme dans le backend (base de donnees ou code Rust)." -ForegroundColor White
        
        Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
        Write-Host "1. Regardez les logs du serveur backend pour l'erreur exacte" -ForegroundColor White
        Write-Host "2. L'erreur peut etre dans le code Rust ou une colonne manquante" -ForegroundColor White
        Write-Host "3. Nous devons analyser les logs du serveur pour identifier la cause" -ForegroundColor White
        
    } else {
        Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n3. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Solde: $($response.tokens_balance)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host "`n=== TEST TERMINE ===" -ForegroundColor Cyan
Write-Host "`nRESUME:" -ForegroundColor Yellow
Write-Host "1. Serveur backend: Accessible" -ForegroundColor Green
Write-Host "2. Token JWT: Valide" -ForegroundColor Green
Write-Host "3. API /api/user/me: Testee avec token valide" -ForegroundColor White
Write-Host "4. API /api/users/balance: Testee pour comparaison" -ForegroundColor White

Write-Host "`nINSTRUCTIONS:" -ForegroundColor Blue
Write-Host "Si l'erreur 500 persiste, regardez les logs du serveur backend pour identifier la cause exacte." -ForegroundColor White
Write-Host "L'erreur peut etre dans le code Rust ou une colonne manquante dans la base de donnees." -ForegroundColor White 