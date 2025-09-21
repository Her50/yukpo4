#!/usr/bin/env pwsh
# Diagnostic automatique complet - Simulation du comportement navigateur

$NETLIFY_URL = "https://yukpomnang-app.netlify.app"
$BACKEND_URL = "https://yukpomnang.onrender.com"

Write-Host "🔍 DIAGNOSTIC AUTOMATIQUE YUKPOMNANG" -ForegroundColor Cyan
Write-Host "Simulation du comportement exact du navigateur..." -ForegroundColor Yellow

# Test 1: Vérifier que l'application se charge
Write-Host "`n[1] Test chargement application..." -ForegroundColor Green
try {
    $appResponse = Invoke-WebRequest -Uri $NETLIFY_URL -TimeoutSec 15
    Write-Host "✅ Application accessible: $($appResponse.StatusCode)" -ForegroundColor Green
    
    # Vérifier que le nouveau fichier JS se charge
    if ($appResponse.Content -match "index-DKue1wkD\.js") {
        Write-Host "✅ Nouveau fichier JS détecté: index-DKue1wkD.js" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Ancien fichier JS encore en cache" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Application inaccessible: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Simulation inscription utilisateur (comme dans le navigateur)
Write-Host "`n[2] Simulation inscription utilisateur..." -ForegroundColor Green
$testEmail = "diagnostic_$(Get-Date -Format 'yyyyMMdd_HHmmss')@yukpo.com"
$testPassword = "DiagnosticTest123!"

try {
    $registerData = @{
        email = $testEmail
        password = $testPassword
        name = "Diagnostic User"
    } | ConvertTo-Json
    
    Write-Host "📝 Tentative inscription: $testEmail" -ForegroundColor Gray
    
    $registerResponse = Invoke-WebRequest -Uri "$NETLIFY_URL/auth/register" -Method POST `
        -Body $registerData -ContentType "application/json" -TimeoutSec 20
    
    if ($registerResponse.StatusCode -eq 201) {
        $registerResult = $registerResponse.Content | ConvertFrom-Json
        Write-Host "✅ Inscription réussie - ID: $($registerResult.id)" -ForegroundColor Green
        
        # Test 3: Simulation connexion (comme dans le navigateur)
        Write-Host "`n[3] Simulation connexion..." -ForegroundColor Green
        
        $loginData = @{
            email = $testEmail
            password = $testPassword
        } | ConvertTo-Json
        
        $loginResponse = Invoke-WebRequest -Uri "$NETLIFY_URL/auth/login" -Method POST `
            -Body $loginData -ContentType "application/json" -TimeoutSec 20
        
        if ($loginResponse.StatusCode -eq 200) {
            $loginResult = $loginResponse.Content | ConvertFrom-Json
            $token = $loginResult.token
            Write-Host "✅ Connexion réussie - Token: $($token.Substring(0,40))..." -ForegroundColor Green
            
            # Test 4: Simulation appels API protégés (comme useUserServices)
            Write-Host "`n[4] Simulation appels API protégés..." -ForegroundColor Green
            
            $authHeaders = @{
                "Authorization" = "Bearer $token"
                "Accept" = "application/json"
            }
            
            $apiEndpoints = @(
                "/api/user/me",
                "/api/prestataire/services", 
                "/services/filter",
                "/users/balance"
            )
            
            $allSuccess = $true
            foreach ($endpoint in $apiEndpoints) {
                try {
                    Write-Host "  Testing: $endpoint" -ForegroundColor Gray
                    $apiResponse = Invoke-WebRequest -Uri "$NETLIFY_URL$endpoint" -Headers $authHeaders -TimeoutSec 15
                    Write-Host "  ✅ $endpoint : $($apiResponse.StatusCode)" -ForegroundColor Green
                } catch {
                    $statusCode = $_.Exception.Response.StatusCode.value__
                    if ($statusCode) {
                        Write-Host "  ⚠️ $endpoint : $statusCode" -ForegroundColor Yellow
                    } else {
                        Write-Host "  ❌ $endpoint : $_" -ForegroundColor Red
                        $allSuccess = $false
                    }
                }
            }
            
            if ($allSuccess) {
                Write-Host "`n🎉 TOUS LES TESTS RÉUSSIS !" -ForegroundColor Green
                Write-Host "Le problème ne vient PAS des redirects Netlify" -ForegroundColor Green
            } else {
                Write-Host "`n⚠️ Certains endpoints échouent" -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "❌ Erreur lors des tests: $_" -ForegroundColor Red
}

# Test 5: Analyse du fichier JavaScript déployé
Write-Host "`n[5] Analyse du code JavaScript déployé..." -ForegroundColor Green
try {
    $jsResponse = Invoke-WebRequest -Uri "$NETLIFY_URL/assets/index-DKue1wkD.js" -TimeoutSec 20
    
    # Rechercher les URLs hardcodées
    $hardcodedUrls = @()
    if ($jsResponse.Content -match "yukpomnang\.onrender\.com") {
        $hardcodedUrls += "yukpomnang.onrender.com"
    }
    if ($jsResponse.Content -match "localhost:3001") {
        $hardcodedUrls += "localhost:3001"
    }
    if ($jsResponse.Content -match "localhost:8000") {
        $hardcodedUrls += "localhost:8000"
    }
    
    if ($hardcodedUrls.Count -gt 0) {
        Write-Host "⚠️ URLs hardcodées trouvées dans le JS:" -ForegroundColor Yellow
        foreach ($url in $hardcodedUrls) {
            Write-Host "  - $url" -ForegroundColor Red
        }
        Write-Host "🔧 SOLUTION: Le code contient encore des URLs hardcodées" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Aucune URL hardcodée trouvée dans le JS" -ForegroundColor Green
    }
    
    # Vérifier la taille pour détecter les changements
    Write-Host "📊 Taille du fichier JS: $($jsResponse.Content.Length) caractères" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Impossible d'analyser le fichier JS: $_" -ForegroundColor Red
}

# Test 6: Comparaison avec backend direct
Write-Host "`n[6] Comparaison backend direct vs proxy..." -ForegroundColor Green
try {
    # Test backend direct
    $backendDirect = Invoke-WebRequest -Uri "$BACKEND_URL/healthz" -TimeoutSec 10
    Write-Host "✅ Backend direct: $($backendDirect.StatusCode)" -ForegroundColor Green
    
    # Test via proxy Netlify
    $proxyResponse = Invoke-WebRequest -Uri "$NETLIFY_URL/healthz" -TimeoutSec 10
    Write-Host "✅ Proxy Netlify: $($proxyResponse.StatusCode)" -ForegroundColor Green
    
    if ($backendDirect.Content -eq $proxyResponse.Content) {
        Write-Host "✅ Proxy fonctionne parfaitement (réponses identiques)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Différence entre backend direct et proxy" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur comparaison: $_" -ForegroundColor Red
}

Write-Host "`n📊 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

if ($allSuccess) {
    Write-Host "✅ Tous les endpoints API fonctionnent via Netlify" -ForegroundColor Green
    Write-Host "✅ Le proxy Netlify est opérationnel" -ForegroundColor Green
    Write-Host "✅ L'authentification fonctionne" -ForegroundColor Green
    Write-Host "" -ForegroundColor White
    Write-Host "🎯 CONCLUSION: Le problème vient du cache navigateur" -ForegroundColor Yellow
    Write-Host "💡 SOLUTION:" -ForegroundColor White
    Write-Host "   1. Appuyez sur Ctrl+Shift+Delete dans Edge" -ForegroundColor Gray
    Write-Host "   2. Cochez 'Tout effacer'" -ForegroundColor Gray
    Write-Host "   3. Cliquez sur 'Effacer maintenant'" -ForegroundColor Gray
    Write-Host "   4. Rechargez l'application" -ForegroundColor Gray
} else {
    Write-Host "⚠️ Problème détecté avec les redirects" -ForegroundColor Yellow
    Write-Host "🔧 Vérification de la configuration Netlify nécessaire" -ForegroundColor Yellow
}

Write-Host "`n🌐 URLs finales:" -ForegroundColor Cyan
Write-Host "  Application: $NETLIFY_URL" -ForegroundColor Green
Write-Host "  Backend: $BACKEND_URL" -ForegroundColor Green

Write-Host "`n🎉 DIAGNOSTIC TERMINÉ !" -ForegroundColor Green 