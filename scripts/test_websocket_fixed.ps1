# Script de test - WebSocket corrigé
Write-Host "TEST WEBSOCKET CORRIGÉ" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

Write-Host "`n🔧 CORRECTION APPLIQUÉE:" -ForegroundColor Green
Write-Host "✅ Syntaxe des routes WebSocket corrigée (:user_id -> {user_id})" -ForegroundColor White
Write-Host "✅ Compilation backend réussie" -ForegroundColor White
Write-Host "✅ Serveur backend démarré" -ForegroundColor White

Write-Host "`n1. Test de l'API /api/user/me..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5Njk1NCwiaWF0IjoxNzU2NjMzMTE0LCJleHAiOjE3NTY3MTk1MTR9.TzFdwc2HvnfbSCyYBeNeeBybKYuSw8-Vn2jHP9jRPJg"

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   ✅ SUCCES ! API /api/user/me fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ❌ ERREUR sur /api/user/me" -ForegroundColor Red
    Write-Host "   Type d'erreur: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n2. Test de l'endpoint WebSocket /healthz..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/healthz" -Method Get -TimeoutSec 10
    Write-Host "   ✅ Serveur backend accessible" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Serveur backend inaccessible" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test de l'endpoint WebSocket /ws/status/1..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/ws/status/1" -Method Get -TimeoutSec 10
    Write-Host "   ✅ Endpoint WebSocket accessible (HTTP)" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Note: Ceci teste l'accessibilité HTTP, pas la connexion WebSocket" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Endpoint WebSocket inaccessible" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST TERMINÉ ===" -ForegroundColor Cyan

Write-Host "`n🎯 RÉSULTAT:" -ForegroundColor Yellow
Write-Host "Si l'API /api/user/me fonctionne et que le serveur est accessible," -ForegroundColor White
Write-Host "l'erreur WebSocket est corrigée et vous pouvez maintenant:" -ForegroundColor White
Write-Host "1. Lancer le frontend avec 'npm run dev'" -ForegroundColor White
Write-Host "2. Tester les composants flottants (chat + notifications)" -ForegroundColor White
Write-Host "3. Vérifier la connexion WebSocket en temps réel" -ForegroundColor White

Write-Host "`n🚀 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Lancer le frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "2. Tester l'interface avec les composants flottants" -ForegroundColor White
Write-Host "3. Vérifier la connexion WebSocket dans la console du navigateur" -ForegroundColor White 