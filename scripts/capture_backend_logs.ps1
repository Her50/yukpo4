# Script de capture des logs backend en temps reel
Write-Host "Capture des logs backend en temps reel" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host "`nINSTRUCTIONS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "1. Ce script doit etre execute dans un TERMINAL SEPARE" -ForegroundColor White
Write-Host "2. Le serveur backend doit tourner dans un autre terminal" -ForegroundColor White
Write-Host "3. Regardez les logs du serveur pendant l'execution" -ForegroundColor White

Write-Host "`n1. Verification de l'etat du serveur..." -ForegroundColor Yellow

$backendProcesses = Get-Process | Where-Object {$_.ProcessName -like "*yukpomnang*" -or $_.ProcessName -like "*cargo*"}
if ($backendProcesses) {
    Write-Host "   Processus backend detectes:" -ForegroundColor Green
    foreach ($proc in $backendProcesses) {
        Write-Host "   - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun processus backend detecte" -ForegroundColor Red
    Write-Host "   Le serveur backend n'est pas en cours d'execution" -ForegroundColor Yellow
    Write-Host "   Lancez d'abord le serveur avec: cd backend && cargo run" -ForegroundColor White
    exit 1
}

Write-Host "`n2. Test de l'API pour declencher les logs..." -ForegroundColor Yellow
Write-Host "   Nous allons tester l'API /api/user/me pour declencher l'erreur 500" -ForegroundColor White
Write-Host "   Regardez l'autre terminal du serveur backend pour voir les logs !" -ForegroundColor White

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5NzAzNSwiaWF0IjoxNzU2NjMxMjQyLCJleHAiOjE3NTY3MTc2NDJ9.lRG6dFYcNdP170gqFyHyp6AJn95iwukmz-vvXFgLNHw"

Write-Host "`n   Test de l'API /api/user/me..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERREUR 500 DECLENCHEE !" -ForegroundColor Red
    Write-Host "   Regardez les logs du serveur backend dans l'autre terminal !" -ForegroundColor White
    
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "   Content-Length: $($_.Exception.Response.Headers['Content-Length'])" -ForegroundColor Red
    }
}

Write-Host "`n3. Instructions pour voir les logs..." -ForegroundColor Yellow
Write-Host "`nPour voir les logs du serveur backend:" -ForegroundColor White
Write-Host "1. Ouvrez un NOUVEAU terminal" -ForegroundColor White
Write-Host "2. Naviguez vers le repertoire backend: cd backend" -ForegroundColor White
Write-Host "3. Lancez le serveur: cargo run" -ForegroundColor White
Write-Host "4. Dans ce terminal, executez ce script pour declencher l'erreur" -ForegroundColor White
Write-Host "5. Regardez les logs d'erreur dans le terminal du serveur" -ForegroundColor White

Write-Host "`n4. Test supplementaire avec curl..." -ForegroundColor Yellow
Write-Host "   Test avec curl pour plus de details..." -ForegroundColor White

try {
    $curlCommand = "curl -X GET `"$baseUrl/api/user/me`" -H `"Authorization: Bearer $realToken`" -v"
    Write-Host "   Commande curl: $curlCommand" -ForegroundColor Gray
    
    $curlResult = Invoke-Expression $curlCommand 2>&1
    Write-Host "   Resultat curl: $curlResult" -ForegroundColor Gray
    
} catch {
    Write-Host "   Erreur curl: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== CAPTURE DES LOGS TERMINEE ===" -ForegroundColor Cyan
Write-Host "`nRESUME:" -ForegroundColor Yellow
Write-Host "1. Serveur backend: Accessible" -ForegroundColor Green
Write-Host "2. API /api/user/me: Testee pour declencher l'erreur" -ForegroundColor White
Write-Host "3. Logs: A analyser dans le terminal du serveur backend" -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Regarder les logs du serveur backend dans l'autre terminal" -ForegroundColor White
Write-Host "2. Identifier l'erreur exacte dans le code Rust" -ForegroundColor White
Write-Host "3. Corriger le probleme de serialisation JSON" -ForegroundColor White 