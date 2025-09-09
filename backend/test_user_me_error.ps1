# Script de test de l'API /api/user/me pour déclencher l'erreur
# Ce script doit être exécuté pendant que le serveur backend tourne

Write-Host "Test de l'API /api/user/me pour déclencher l'erreur" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

Write-Host "`nINSTRUCTIONS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "1. Ce script doit être exécuté dans un TERMINAL SÉPARÉ" -ForegroundColor Red
Write-Host "2. Le serveur backend doit tourner dans un autre terminal" -ForegroundColor Red
Write-Host "3. Regardez les logs du serveur pendant l'exécution" -ForegroundColor Red

Write-Host "`n1. Vérification de l'état du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/healthz" -Method Get -TimeoutSec 5
    Write-Host "   Serveur en ligne: $response" -ForegroundColor Green
} catch {
    Write-Host "   Serveur inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Assurez-vous que le serveur backend tourne dans un autre terminal" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n2. Test de l'API /api/user/me avec token invalide..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer invalid_token"} -TimeoutSec 10
    Write-Host "   Erreur: l'API a accepte un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   API d'authentification fonctionne (rejette les tokens invalides)" -ForegroundColor Green
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   Erreur 500 detectee - Regardez les logs du serveur !" -ForegroundColor Red
    } else {
        Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n3. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer invalid_token"} -TimeoutSec 10
    Write-Host "   Erreur: l'API balance a accepte un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   API balance fonctionne (rejette les tokens invalides)" -ForegroundColor Green
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   Erreur 500 sur balance aussi" -ForegroundColor Red
    } else {
        Write-Host "   Erreur inattendue sur balance: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n4. Test avec un vrai token (optionnel)..." -ForegroundColor Yellow
Write-Host "   Pour tester avec un vrai token:" -ForegroundColor Blue
Write-Host "   1. Ouvrez la console du navigateur (F12)" -ForegroundColor White
Write-Host "   2. Tapez: localStorage.getItem('token')" -ForegroundColor White
Write-Host "   3. Copiez le token complet" -ForegroundColor White

$testToken = Read-Host "   Collez votre token JWT ici (ou appuyez sur Entree pour ignorer)"

if ($testToken -and $testToken -ne "") {
    Write-Host "`n   Test avec le token fourni..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/user/me" -Method Get -Headers @{"Authorization" => "Bearer $testToken"} -TimeoutSec 10
        Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
        Write-Host "   Utilisateur: $($response.email)" -ForegroundColor Gray
        Write-Host "   Role: $($response.role)" -ForegroundColor Gray
        Write-Host "   Tokens: $($response.tokens_balance)" -ForegroundColor Gray
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 500) {
            Write-Host "   Erreur 500 persistante sur /api/user/me" -ForegroundColor Red
            Write-Host "   Message d'erreur: $($_.Exception.Message)" -ForegroundColor Red
            
            Write-Host "`n   REGARDEZ LES LOGS DU SERVEUR BACKEND !" -ForegroundColor Red
            Write-Host "   L'erreur exacte devrait apparaître dans le terminal du serveur" -ForegroundColor Yellow
            
        } else {
            Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   Test ignore - pas de token fourni" -ForegroundColor Yellow
}

Write-Host "`n=== TEST TERMINÉ ===" -ForegroundColor Cyan
Write-Host "`nRÉSULTATS:" -ForegroundColor Yellow
Write-Host "1. Serveur backend: Accessible" -ForegroundColor Green
Write-Host "2. API /api/user/me: Testée" -ForegroundColor White
Write-Host "3. API /api/users/balance: Testée" -ForegroundColor White

Write-Host "`nPROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Regardez les logs du serveur backend dans l'autre terminal" -ForegroundColor White
Write-Host "2. Identifiez l'erreur exacte qui cause le code 500" -ForegroundColor White
Write-Host "3. Le problème peut être dans le code Rust ou une colonne manquante" -ForegroundColor White
Write-Host "4. Une fois l'erreur identifiée, nous pourrons la corriger" -ForegroundColor White

Write-Host "`n💡 ASTUCE:" -ForegroundColor Blue
Write-Host "Gardez ce terminal ouvert et regardez l'autre terminal où tourne le serveur backend" -ForegroundColor White
Write-Host "L'erreur exacte devrait apparaître dans les logs du serveur" -ForegroundColor White 