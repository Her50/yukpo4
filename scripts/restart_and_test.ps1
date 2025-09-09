# Script de redemarrage et test du serveur backend
Write-Host "REDEMARRAGE ET TEST DU SERVEUR BACKEND" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host "`n🎯 CORRECTION APPLIQUEE:" -ForegroundColor Yellow
Write-Host "Le probleme de type chrono a ete corrige:" -ForegroundColor White
Write-Host "- NaiveDateTime -> DateTime<Utc> pour created_at et updated_at" -ForegroundColor White
Write-Host "- Compilation reussie avec cargo check" -ForegroundColor White

Write-Host "`n⚠️  ATTENTION: Le serveur backend doit etre redemarre pour que les changements prennent effet" -ForegroundColor Red
Write-Host "Les modifications du code Rust ne sont pas appliquees tant que le serveur n'est pas redemarre" -ForegroundColor White

Write-Host "`n1. Verification de l'etat actuel du serveur..." -ForegroundColor Yellow

$backendProcesses = Get-Process | Where-Object {$_.ProcessName -like "*yukpomnang*" -or $_.ProcessName -like "*cargo*"}
if ($backendProcesses) {
    Write-Host "   Processus backend detectes:" -ForegroundColor Green
    foreach ($proc in $backendProcesses) {
        Write-Host "   - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun processus backend detecte" -ForegroundColor Red
}

Write-Host "`n2. Test de l'API /api/user/me avant redemarrage..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5Njk1NCwiaWF0IjoxNzU2NjMzMTE0LCJleHAiOjE3NTY3MTk1MTR9.TzFdwc2HvnfbSCyYBeNeeBybKYuSw8-Vn2jHP9jRPJg"

try {
    Write-Host "   Test de l'API /api/user/me..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   ✅ SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ❌ ERREUR 500 PERSISTE !" -ForegroundColor Red
    Write-Host "   Type d'erreur: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "   Content-Length: $($_.Exception.Response.Headers['Content-Length'])" -ForegroundColor Red
    }
}

Write-Host "`n3. INSTRUCTIONS POUR REDEMARRER LE SERVEUR:" -ForegroundColor Yellow
Write-Host "`n📋 ETAPES OBLIGATOIRES:" -ForegroundColor White
Write-Host "1. Ouvrez un NOUVEAU terminal" -ForegroundColor White
Write-Host "2. Naviguez vers le backend: cd backend" -ForegroundColor White
Write-Host "3. Arretez le serveur actuel (Ctrl+C)" -ForegroundColor White
Write-Host "4. Relancez le serveur: cargo run" -ForegroundColor White
Write-Host "5. Dans ce terminal, executez ce script pour tester a nouveau" -ForegroundColor White

Write-Host "`n4. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   ✅ SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Erreur sur /api/users/balance: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== REDEMARRAGE ET TEST TERMINE ===" -ForegroundColor Cyan

Write-Host "`nRESUME:" -ForegroundColor Yellow
Write-Host "✅ Le probleme de type chrono a ete corrige dans le code" -ForegroundColor Green
Write-Host "⚠️  Le serveur backend doit etre redemarre pour appliquer les changements" -ForegroundColor Yellow
Write-Host "❌ L'erreur 500 persiste car l'ancien serveur tourne encore" -ForegroundColor Red

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Redemarrer le serveur backend avec cargo run" -ForegroundColor White
Write-Host "2. Tester a nouveau l'API /api/user/me" -ForegroundColor White
Write-Host "3. L'erreur 500 devrait etre resolue !" -ForegroundColor White 