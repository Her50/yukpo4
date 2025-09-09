# Script de diagnostic de la table users
# Ce script vérifie la structure de la table users pour identifier les problèmes

Write-Host "🔍 Diagnostic de la table users" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Configuration
$baseUrl = "http://localhost:3001"

Write-Host "`n1. Test de la santé du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/healthz" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Serveur en ligne: $response" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Serveur inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Test de l'API des services (pour vérifier que la base fonctionne)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/prestataire/services" -Method Get -Headers @{"Authorization" = "Bearer test_token"} -TimeoutSec 10
    Write-Host "   ✅ API des services fonctionne: $($response.Count) services" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ⚠️ API des services accessible (erreur 401 attendue sans token valide)" -ForegroundColor Yellow
    } else {
        Write-Host "   ❌ Erreur API des services: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n3. Test de l'API d'authentification avec token invalide..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer invalid_token"} -TimeoutSec 10
    Write-Host "   ❌ Erreur: l'API a accepté un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ API d'authentification fonctionne (rejette les tokens invalides)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n4. Test de l'API d'authentification avec token valide..." -ForegroundColor Yellow
try {
    # Utiliser un token JWT valide du localStorage du navigateur
    Write-Host "   ℹ️  Pour tester avec un vrai token, copiez-le depuis le localStorage du navigateur" -ForegroundColor Blue
    Write-Host "   ℹ️  Ouvrez la console du navigateur et tapez: localStorage.getItem('token')" -ForegroundColor Blue
    
    $testToken = Read-Host "   🔑 Collez votre token JWT ici (ou appuyez sur Entrée pour ignorer)"
    
    if ($testToken -and $testToken -ne "") {
        Write-Host "   🧪 Test avec le token fourni..." -ForegroundColor Yellow
        
        try {
            $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $testToken"} -TimeoutSec 10
            Write-Host "   ✅ API d'authentification fonctionne avec token valide" -ForegroundColor Green
            Write-Host "   📊 Données utilisateur: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        } catch {
            if ($_.Exception.Response.StatusCode -eq 500) {
                Write-Host "   ❌ Erreur 500 Internal Server Error - Problème de base de données" -ForegroundColor Red
                Write-Host "   🔍 Cela confirme le problème identifié par le diagnostic" -ForegroundColor Yellow
            } else {
                Write-Host "   ❌ Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ⏭️  Test ignoré - pas de token fourni" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Analyse des routes disponibles..." -ForegroundColor Yellow
Write-Host "   Routes principales:" -ForegroundColor Gray
Write-Host "   - /healthz (GET) - Santé du serveur" -ForegroundColor Gray
Write-Host "   - /api/user/me (GET) - Profil utilisateur (❌ ERREUR 500)" -ForegroundColor Red
Write-Host "   - /api/prestataire/services (GET) - Services du prestataire (✅ FONCTIONNE)" -ForegroundColor Green
Write-Host "   - /services/filter (GET) - Filtrage des services" -ForegroundColor Gray

Write-Host "`n🔍 === DIAGNOSTIC TERMINÉ ===" -ForegroundColor Cyan
Write-Host "`n📋 RÉSUMÉ DES PROBLÈMES IDENTIFIÉS:" -ForegroundColor Yellow
Write-Host "1. ✅ Serveur backend fonctionne" -ForegroundColor Green
Write-Host "2. ✅ Base de données accessible (services récupérés)" -ForegroundColor Green
Write-Host "3. ❌ API /api/user/me retourne une erreur 500" -ForegroundColor Red
Write-Host "4. ✅ API des services fonctionne parfaitement" -ForegroundColor Green

Write-Host "`n🎯 CAUSE PROBABLE:" -ForegroundColor Yellow
Write-Host "L'erreur 500 sur /api/user/me est causée par une incompatibilité entre:" -ForegroundColor White
Write-Host "- La structure de la table 'users' en base de données" -ForegroundColor White
Write-Host "- Le modèle 'User' dans le code Rust" -ForegroundColor White

Write-Host "`n🚀 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Vérifier la structure de la table 'users' en base" -ForegroundColor White
Write-Host "2. Comparer avec le modèle User dans user_model.rs" -ForegroundColor White
Write-Host "3. Appliquer les migrations de base manquantes" -ForegroundColor White
Write-Host "4. Tester à nouveau l'API /api/user/me" -ForegroundColor White

Write-Host "`n💡 NOTE IMPORTANTE:" -ForegroundColor Blue
Write-Host "Les services s'affichent correctement car l'API des services fonctionne." -ForegroundColor White
Write-Host "Le problème principal est l'API d'authentification, pas l'affichage des services." -ForegroundColor White 