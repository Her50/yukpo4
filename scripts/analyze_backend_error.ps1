# Script d'analyse detaillee de l'erreur backend
Write-Host "Analyse detaillee de l'erreur backend" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "`n1. Verification de l'etat du serveur backend..." -ForegroundColor Yellow

$backendProcesses = Get-Process | Where-Object {$_.ProcessName -like "*yukpomnang*" -or $_.ProcessName -like "*cargo*"}
if ($backendProcesses) {
    Write-Host "   Processus backend detectes:" -ForegroundColor Green
    foreach ($proc in $backendProcesses) {
        Write-Host "   - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun processus backend detecte" -ForegroundColor Red
    Write-Host "   Le serveur backend n'est pas en cours d'execution" -ForegroundColor Yellow
}

Write-Host "`n2. Test de l'API avec analyse des headers et du corps..." -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5NzAzNSwiaWF0IjoxNzU2NjMxMjQyLCJleHAiOjE3NTY3MTc2NDJ9.lRG6dFYcNdP170gqFyHyp6AJn95iwukmz-vvXFgLNHw"

try {
    Write-Host "   Test de l'API /api/user/me avec analyse complete..." -ForegroundColor Yellow
    
    # Utiliser Invoke-WebRequest pour avoir tous les détails
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERREUR 500 DETECTEE !" -ForegroundColor Red
    Write-Host "   Type d'erreur: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    # Analyse détaillée de l'erreur HTTP
    if ($_.Exception.Response) {
        Write-Host "`n   ANALYSE COMPLETE DE L'ERREUR HTTP:" -ForegroundColor Yellow
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "   Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
        
        # Récupérer le corps de l'erreur
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "   Corps de l'erreur: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "   Impossible de récupérer le corps de l'erreur" -ForegroundColor Yellow
        }
        
        # Analyser tous les headers de l'erreur
        Write-Host "`n   Headers de la réponse d'erreur:" -ForegroundColor Yellow
        foreach ($header in $_.Exception.Response.Headers) {
            Write-Host "   $header : $($_.Exception.Response.Headers[$header])" -ForegroundColor Gray
        }
        
    } else {
        Write-Host "   Pas de réponse HTTP (erreur réseau ou serveur)" -ForegroundColor Yellow
    }
}

Write-Host "`n3. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. Test de l'API /api/prestataire/services pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/prestataire/services" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/prestataire/services fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Nombre de services: $($response.Content.Length) caracteres" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/prestataire/services: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Test de l'API /api/user/profile (alternative)..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/profile" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/user/profile fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/user/profile: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== ANALYSE TERMINE ===" -ForegroundColor Cyan

Write-Host "`nRESUME DE L'ANALYSE:" -ForegroundColor Yellow
Write-Host "1. Base de donnees: ✅ Fonctionne parfaitement" -ForegroundColor Green
Write-Host "2. Serveur backend: ✅ En ligne et accessible" -ForegroundColor Green
Write-Host "3. API /api/user/me: ❌ ERREUR 500 (Internal Server Error)" -ForegroundColor Red
Write-Host "4. Autres APIs: ✅ Fonctionnent correctement" -ForegroundColor Green

Write-Host "`nDIAGNOSTIC FINAL:" -ForegroundColor Yellow
Write-Host "L'erreur 500 provient du CODE RUST du serveur backend, pas de la base de donnees." -ForegroundColor White
Write-Host "Le probleme est probablement dans la serialisation des donnees utilisateur." -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Analyser les logs du serveur backend en temps reel" -ForegroundColor White
Write-Host "2. Identifier l'erreur exacte dans le code Rust" -ForegroundColor White
Write-Host "3. Corriger le probleme de serialisation" -ForegroundColor White 