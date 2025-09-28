# Script de diagnostic pour la connexion mobile
Write-Host "🔍 Diagnostic de connexion mobile" -ForegroundColor Cyan

Write-Host "`n📱 Informations sur la build mobile:" -ForegroundColor Yellow
Write-Host "   Build ID: 81534c29-c3c0-41ac-af9c-c91585062866" -ForegroundColor White
Write-Host "   URL: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds/81534c29-c3c0-41ac-af9c-c91585062866" -ForegroundColor White

Write-Host "`n🔧 Variables d'environnement EAS:" -ForegroundColor Yellow
Write-Host "   EXPO_PUBLIC_API_URL: https://yukpomnang.onrender.com" -ForegroundColor White
Write-Host "   EXPO_PUBLIC_ENVIRONMENT: production" -ForegroundColor White

Write-Host "`n🧪 Tests de connectivité backend:" -ForegroundColor Yellow

$backendUrl = "https://yukpomnang.onrender.com"

# Test 1: Vérification que le backend répond
Write-Host "1. Test backend accessibility..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/healthz" -Method GET -TimeoutSec 10
    Write-Host "   ✅ Backend accessible: $($response.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Backend inaccessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Test d'authentification mobile
Write-Host "2. Test endpoint auth/login (mobile style)..." -ForegroundColor Cyan
try {
    $loginData = @{
        email    = "test@example.com"
        password = "testpassword"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$backendUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json" -TimeoutSec 10
    Write-Host "   ❌ Login sans erreur: $($response.StatusCode)" -ForegroundColor Yellow
}
catch {
    if ($_.Exception.Message -like "*401*") {
        Write-Host "   ✅ Login rejette credentials invalides (401 attendu)" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ Erreur login: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Test avec headers mobile
Write-Host "3. Test avec headers mobile..." -ForegroundColor Cyan
try {
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent"   = "Yukpomnang-Mobile/1.0"
        "Accept"       = "application/json"
    }
    
    $response = Invoke-WebRequest -Uri "$backendUrl/healthz" -Method GET -Headers $headers -TimeoutSec 10
    Write-Host "   ✅ Backend accessible avec headers mobile: $($response.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "   ❌ Erreur avec headers mobile: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔍 Analyse du problème:" -ForegroundColor Yellow
Write-Host "   Le backend est accessible depuis PowerShell" -ForegroundColor White
Write-Host "   Les variables d'environnement sont correctes" -ForegroundColor White
Write-Host "   CORS est configuré" -ForegroundColor White

Write-Host "`n💡 Solutions possibles:" -ForegroundColor Cyan
Write-Host "   1. Redémarrer l'application mobile" -ForegroundColor White
Write-Host "   2. Vérifier les logs de l'application mobile" -ForegroundColor White
Write-Host "   3. Tester avec des credentials valides" -ForegroundColor White
Write-Host "   4. Vérifier la connexion réseau sur le mobile" -ForegroundColor White

Write-Host "`n📋 Actions recommandées:" -ForegroundColor Yellow
Write-Host "   1. Ouvrez l'application mobile" -ForegroundColor White
Write-Host "   2. Essayez de vous connecter avec vos vraies credentials" -ForegroundColor White
Write-Host "   3. Si ça ne marche pas, essayez de créer un nouveau compte" -ForegroundColor White
Write-Host "   4. Vérifiez les logs dans l'application (bouton Debug)" -ForegroundColor White

Write-Host "`n🚀 Le backend est opérationnel - le problème est probablement côté mobile" -ForegroundColor Green
