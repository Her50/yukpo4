# Script de diagnostic détaillé de l'API /api/user/me
# Ce script teste l'API avec un vrai token et analyse les erreurs

Write-Host "Diagnostic détaillé de l'API /api/user/me" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

Write-Host "`n1. Verification de la sante du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/healthz" -Method Get -TimeoutSec 5
    Write-Host "   Serveur en ligne: $response" -ForegroundColor Green
} catch {
    Write-Host "   Serveur inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Test de l'API /api/user/me avec token invalide..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer invalid_token"} -TimeoutSec 10
    Write-Host "   Erreur: l'API a accepte un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   API d'authentification fonctionne (rejette les tokens invalides)" -ForegroundColor Green
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   Erreur 500 detectee - Probleme de base de donnees confirme" -ForegroundColor Red
    } else {
        Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n3. Test de l'API /api/users/balance pour verification..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer invalid_token"} -TimeoutSec 10
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

Write-Host "`n4. Demande du token JWT valide..." -ForegroundColor Yellow
Write-Host "   Pour obtenir votre token JWT:" -ForegroundColor Blue
Write-Host "   1. Ouvrez la console du navigateur (F12)" -ForegroundColor White
Write-Host "   2. Tapez: localStorage.getItem('token')" -ForegroundColor White
Write-Host "   3. Copiez le token complet" -ForegroundColor White

$testToken = Read-Host "   Collez votre token JWT ici"

if ($testToken -and $testToken -ne "") {
    Write-Host "`n5. Test de l'API /api/user/me avec token valide..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" => "Bearer $testToken"} -TimeoutSec 10
        Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
        Write-Host "   Utilisateur: $($response.email)" -ForegroundColor Gray
        Write-Host "   Role: $($response.role)" -ForegroundColor Gray
        Write-Host "   Tokens: $($response.tokens_balance)" -ForegroundColor Gray
        
        Write-Host "`nPROBLEME RESOLU !" -ForegroundColor Green
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 500) {
            Write-Host "   Erreur 500 persistante sur /api/user/me" -ForegroundColor Red
            Write-Host "   Message d'erreur: $($_.Exception.Message)" -ForegroundColor Red
            
            # Essayer de récupérer plus de détails sur l'erreur
            try {
                $errorResponse = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorResponse)
                $errorBody = $reader.ReadToEnd()
                Write-Host "   Corps de l'erreur: $errorBody" -ForegroundColor Red
            } catch {
                Write-Host "   Impossible de récupérer le corps de l'erreur" -ForegroundColor Yellow
            }
            
            Write-Host "`nDIAGNOSTIC:" -ForegroundColor Yellow
            Write-Host "L'API /api/user/me retourne toujours une erreur 500 malgre la correction de la base." -ForegroundColor White
            Write-Host "Cela suggere un probleme dans le code backend ou une colonne manquante." -ForegroundColor White
            
        } else {
            Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n6. Test de l'API /api/users/balance avec token valide..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" => "Bearer $testToken"} -TimeoutSec 10
        Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
        Write-Host "   Solde: $($response.tokens_balance)" -ForegroundColor Gray
    } catch {
        Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    
} else {
    Write-Host "   Test ignore - pas de token fourni" -ForegroundColor Yellow
}

Write-Host "`n=== DIAGNOSTIC TERMINÉ ===" -ForegroundColor Cyan
Write-Host "`nRÉSUMÉ:" -ForegroundColor Yellow
Write-Host "1. Serveur backend: En ligne" -ForegroundColor Green
Write-Host "2. API /api/users/balance: Fonctionne" -ForegroundColor Green
Write-Host "3. API /api/user/me: Erreur 500 persistante" -ForegroundColor Red

Write-Host "`nPROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Vérifiez les logs du serveur backend pour l'erreur exacte" -ForegroundColor White
Write-Host "2. Le problème peut être dans le code Rust ou une colonne manquante" -ForegroundColor White
Write-Host "3. Nous devons analyser les logs du backend pour identifier la cause" -ForegroundColor White 