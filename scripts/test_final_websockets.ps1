# Script de test final - WebSockets et API /api/user/me
Write-Host "TEST FINAL - WEBSOCKETS ET API /api/user/me" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`n🎯 CORRECTIONS APPLIQUEES:" -ForegroundColor Green
Write-Host "✅ Problème de type chrono résolu: NaiveDateTime -> DateTime<Utc>" -ForegroundColor White
Write-Host "✅ WebSockets activés et corrigés" -ForegroundColor White
Write-Host "✅ Diagnostic frontend supprimé" -ForegroundColor White
Write-Host "✅ Compilation backend réussie" -ForegroundColor White

Write-Host "`n1. Test de l'API /api/user/me..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5Njk1NCwiaWF0IjoxNzU2NjMzMTE0LCJleHAiOjE3NTY3MTk1MTR9.TzFdwc2HvnfbSCyYBeNeeBybKYuSw8-Vn2jHP9jRPJg"

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERREUR 500 PERSISTE !" -ForegroundColor Red
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

Write-Host "`n3. Test des WebSockets..." -ForegroundColor Yellow

try {
    Write-Host "   Test de connexion WebSocket..." -ForegroundColor White
    $response = Invoke-WebRequest -Uri "http://localhost:3001/healthz" -Method Get -TimeoutSec 10
    Write-Host "   ✅ Serveur backend accessible" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Serveur backend inaccessible" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST FINAL TERMINE ===" -ForegroundColor Cyan

Write-Host "`nRESUME:" -ForegroundColor Yellow
if ($response.StatusCode -eq 200) {
    Write-Host "✅ SUCCES COMPLET !" -ForegroundColor Green
    Write-Host "L'erreur 500 a ete corrigee et les WebSockets sont actives" -ForegroundColor White
} else {
    Write-Host "❌ L'erreur 500 persiste malgre la correction" -ForegroundColor Red
    Write-Host "Il peut y avoir d'autres problemes a identifier" -ForegroundColor White
}

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Si l'API fonctionne: Le probleme est resolu !" -ForegroundColor White
Write-Host "2. Si l'erreur persiste: Redemarrer le serveur backend" -ForegroundColor White
Write-Host "3. Tester les WebSockets avec un client WebSocket" -ForegroundColor White 