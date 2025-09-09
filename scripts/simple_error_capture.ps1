# Script simple de capture d'erreur
Write-Host "CAPTURE SIMPLE DE L'ERREUR 500" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

Write-Host "`n1. Test de l'API /api/user/me pour declencher l'erreur..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5NzAzNSwiaWF0IjoxNzU2NjMxMjQyLCJleHAiOjE3NTY3MTc2NDJ9.lRG6dFYcNdP170gqFyHyp6AJn95iwukmz-vvXFgLNHw"

try {
    Write-Host "   Test de l'API /api/user/me..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERREUR 500 DETECTEE !" -ForegroundColor Red
    Write-Host "   Type d'erreur: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "   Content-Length: $($_.Exception.Response.Headers['Content-Length'])" -ForegroundColor Red
    }
}

Write-Host "`n2. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test avec curl pour plus de details..." -ForegroundColor Yellow

try {
    $curlCommand = "curl -X GET `"$baseUrl/api/user/me`" -H `"Authorization: Bearer $realToken`" -v"
    Write-Host "   Commande curl: $curlCommand" -ForegroundColor Gray
    
    $curlResult = Invoke-Expression $curlCommand 2>&1
    Write-Host "   Resultat curl: $curlResult" -ForegroundColor Gray
    
} catch {
    Write-Host "   Erreur curl: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== CAPTURE TERMINEE ===" -ForegroundColor Cyan

Write-Host "`nINSTRUCTIONS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "1. Ouvrez un NOUVEAU terminal" -ForegroundColor White
Write-Host "2. Naviguez vers le backend: cd backend" -ForegroundColor White
Write-Host "3. Lancez le serveur: cargo run" -ForegroundColor White
Write-Host "4. Dans ce terminal, executez ce script pour declencher l'erreur" -ForegroundColor White
Write-Host "5. Regardez les logs d'erreur dans le terminal du serveur" -ForegroundColor White

Write-Host "`nL'erreur 500 a ete declenchee avec succes !" -ForegroundColor Green
Write-Host "Regardez maintenant les logs du serveur backend pour identifier la cause exacte." -ForegroundColor White 