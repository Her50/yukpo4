# Script de vérification des logs du serveur backend en temps réel
Write-Host "Verification des logs du serveur backend en temps reel" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

Write-Host "`nINSTRUCTIONS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "1. Ce script doit etre execute dans un TERMINAL SEPARE" -ForegroundColor Red
Write-Host "2. Le serveur backend doit tourner dans un autre terminal" -ForegroundColor Red
Write-Host "3. Regardez les logs du serveur pendant l'execution" -ForegroundColor Red

Write-Host "`n1. Verification de l'etat du serveur..." -ForegroundColor Yellow

# Verifier si le serveur backend est en cours d'execution
$backendProcesses = Get-Process | Where-Object { $_.ProcessName -like "*rust*" -or $_.ProcessName -like "*backend*" -or $_.ProcessName -like "*cargo*" }

if ($backendProcesses) {
    Write-Host "   Processus backend detectes:" -ForegroundColor Green
    foreach ($process in $backendProcesses) {
        Write-Host "   - $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun processus backend detecte" -ForegroundColor Yellow
}

Write-Host "`n2. Test de l'API pour declencher les logs..." -ForegroundColor Yellow
Write-Host "   Nous allons tester l'API /api/user/me pour declencher l'erreur 500" -ForegroundColor White
Write-Host "   Regardez l'autre terminal du serveur backend pour voir les logs !" -ForegroundColor Red

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5NzAzNSwiaWF0IjoxNzU2NjMxMjQyLCJleHAiOjE3NTY3MTc2NDJ9.lRG6dFYcNdP170gqFyHyp6AJn95iwukmz-vvXFgLNHw"

try {
    Write-Host "   Test de l'API /api/user/me..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   ERREUR 500 DECLENCHEE !" -ForegroundColor Red
        Write-Host "   Regardez les logs du serveur backend dans l'autre terminal !" -ForegroundColor Red
    } else {
        Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n3. Instructions pour voir les logs..." -ForegroundColor Yellow
Write-Host "   Pour voir les logs du serveur backend:" -ForegroundColor Blue
Write-Host "   1. Ouvrez un NOUVEAU terminal" -ForegroundColor White
Write-Host "   2. Naviguez vers le repertoire backend: cd backend" -ForegroundColor White
Write-Host "   3. Lancez le serveur: cargo run" -ForegroundColor White
Write-Host "   4. Dans ce terminal, executez ce script pour declencher l'erreur" -ForegroundColor White
Write-Host "   5. Regardez les logs dans le terminal du serveur" -ForegroundColor White

Write-Host "`n4. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Solde: $($response.tokens_balance)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host "`n=== VERIFICATION TERMINEE ===" -ForegroundColor Cyan
Write-Host "`nRESUME:" -ForegroundColor Yellow
Write-Host "1. Processus backend: $($backendProcesses.Count) detecte(s)" -ForegroundColor White
Write-Host "2. API /api/user/me: Testee et erreur 500 declenchee" -ForegroundColor White
Write-Host "3. API /api/users/balance: Testee pour comparaison" -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Ouvrez un nouveau terminal et lancez le serveur backend avec 'cargo run'" -ForegroundColor White
Write-Host "2. Dans ce terminal, executez ce script pour declencher l'erreur" -ForegroundColor White
Write-Host "3. Regardez les logs du serveur pour identifier l'erreur exacte" -ForegroundColor White
Write-Host "4. Une fois l'erreur identifiee, nous pourrons la corriger" -ForegroundColor White

Write-Host "`n💡 ASTUCE:" -ForegroundColor Blue
Write-Host "Gardez ce terminal ouvert et regardez l'autre terminal ou tourne le serveur backend" -ForegroundColor White
Write-Host "L'erreur exacte devrait apparaître dans les logs du serveur" -ForegroundColor White 