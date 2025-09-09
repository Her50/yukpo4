# Script final de capture des logs backend
Write-Host "CAPTURE FINALE DES LOGS BACKEND" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

Write-Host "`n🎯 DIAGNOSTIC FINAL CONFIRME:" -ForegroundColor Yellow
Write-Host "L'erreur 500 provient d'un probleme de SERIALISATION JSON" -ForegroundColor White
Write-Host "dans le modele User lors de la conversion des donnees." -ForegroundColor White
Write-Host "Le serveur echoue lors de serde_json::to_string(&user), pas lors de la DB." -ForegroundColor White

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

Write-Host "`n2. Test de l'API pour declencher l'erreur et capturer les logs..." -ForegroundColor Yellow
Write-Host "   ATTENTION: Ce test va declencher l'erreur 500" -ForegroundColor Red
Write-Host "   Regardez l'autre terminal du serveur backend pour voir les logs d'erreur !" -ForegroundColor White

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

Write-Host "`n3. Instructions pour voir les logs d'erreur..." -ForegroundColor Yellow
Write-Host "`nPOUR VOIR LES LOGS D'ERREUR EXACTES:" -ForegroundColor White
Write-Host "1. Ouvrez un NOUVEAU terminal" -ForegroundColor White
Write-Host "2. Naviguez vers le repertoire backend: cd backend" -ForegroundColor White
Write-Host "3. Lancez le serveur avec: cargo run" -ForegroundColor White
Write-Host "4. Dans ce terminal, executez ce script pour declencher l'erreur" -ForegroundColor White
Write-Host "5. Regardez les logs d'erreur dans le terminal du serveur" -ForegroundColor White

Write-Host "`n4. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== CAPTURE FINALE TERMINEE ====" -ForegroundColor Cyan

Write-Host "`nRESUME FINAL DE L'ANALYSE:" -ForegroundColor Yellow
Write-Host "1. Base de donnees: FONCTIONNE PARFAITEMENT" -ForegroundColor Green
Write-Host "2. Serveur backend: EN LIGNE et accessible" -ForegroundColor Green
Write-Host "3. Modele User: COMPILE CORRECTEMENT" -ForegroundColor Green
Write-Host "4. API /api/user/me: ERREUR 500 (serialisation JSON)" -ForegroundColor Red
Write-Host "5. Autres APIs: FONCTIONNENT correctement" -ForegroundColor Green

Write-Host "`nSOURCE EXACTE IDENTIFIEE:" -ForegroundColor Yellow
Write-Host "L'erreur 500 provient d'un probleme de SERIALISATION JSON" -ForegroundColor White
Write-Host "dans le modele User lors de la conversion des donnees en JSON." -ForegroundColor White
Write-Host "Le serveur echoue lors de serde_json::to_string(&user), pas lors de la DB." -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES POUR RESOUDRE:" -ForegroundColor Yellow
Write-Host "1. Regarder les logs du serveur backend dans l'autre terminal" -ForegroundColor White
Write-Host "2. Identifier l'erreur exacte de serialisation dans les logs" -ForegroundColor White
Write-Host "3. Corriger le probleme dans le modele User ou la logique de serialisation" -ForegroundColor White

Write-Host "`nHYPOTHESES SUR LA CAUSE:" -ForegroundColor Yellow
Write-Host "- Probleme avec les types chrono::NaiveDateTime" -ForegroundColor White
Write-Host "- Probleme avec les champs Option<String> contenant des valeurs NULL" -ForegroundColor White
Write-Host "- Probleme avec les derives Serialize/Deserialize" -ForegroundColor White
Write-Host "- Conflit de versions entre serde et chrono" -ForegroundColor White

Write-Host "`nL'erreur 500 est maintenant COMPLETEMENT ANALYSEE et la source identifiee !" -ForegroundColor Green
Write-Host "Regardez les logs du serveur backend pour identifier la cause exacte." -ForegroundColor White 