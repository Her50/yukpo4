# Script de test pour l'application mobile
Write-Host "Test de l'application mobile Yukpomnang..." -ForegroundColor Cyan

Write-Host "`n1. Verification des corrections apportees..." -ForegroundColor Yellow

# Verifier que l'AuthContext a ete corrige
$authContextFile = "src/contexts/AuthContext.tsx"
if (Test-Path $authContextFile) {
    $content = Get-Content $authContextFile -Raw
    if ($content -match "console.log.*AuthContext.*Etat actuel" -and $content -notmatch "logAuth.*Etat actuel") {
        Write-Host "   ✅ AuthContext corrige (logs simplifies)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ AuthContext non corrige" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ AuthContext manquant" -ForegroundColor Red
}

# Verifier la configuration API
$configFile = "src/config/environment.ts"
if (Test-Path $configFile) {
    $config = Get-Content $configFile
    if ($config -match "yukpomnang.onrender.com") {
        Write-Host "   ✅ Configuration API correcte" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Configuration API incorrecte" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Fichier de configuration manquant" -ForegroundColor Red
}

Write-Host "`n2. Test de connexion au backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://yukpomnang.onrender.com/healthz" -Method GET
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Backend inaccessible" -ForegroundColor Red
}

Write-Host "`n3. Instructions pour tester l'application:" -ForegroundColor Cyan
Write-Host "   1. Lancer l'application:" -ForegroundColor White
Write-Host "      npm start" -ForegroundColor Gray
Write-Host "   2. Ouvrir dans Expo Go ou simulateur" -ForegroundColor White
Write-Host "   3. Tester la connexion avec:" -ForegroundColor White
Write-Host "      Email: test@example.com" -ForegroundColor Gray
Write-Host "      Mot de passe: test123" -ForegroundColor Gray
Write-Host "   4. Tester la creation de compte" -ForegroundColor White
Write-Host "   5. Verifier que la navigation fonctionne" -ForegroundColor White

Write-Host "`n4. Points de verification:" -ForegroundColor Cyan
Write-Host "   - La page de connexion s'affiche au demarrage" -ForegroundColor White
Write-Host "   - La connexion redirige vers l'app principale" -ForegroundColor White
Write-Host "   - La creation de compte fonctionne" -ForegroundColor White
Write-Host "   - La navigation entre Login/Register fonctionne" -ForegroundColor White
Write-Host "   - Les logs de debug s'affichent dans la console" -ForegroundColor White

Write-Host "`n5. En cas de probleme:" -ForegroundColor Cyan
Write-Host "   - Verifier les logs dans la console de l'app" -ForegroundColor White
Write-Host "   - S'assurer que le backend est accessible" -ForegroundColor White
Write-Host "   - Verifier la configuration CORS" -ForegroundColor White
Write-Host "   - Redemarrer l'application si necessaire" -ForegroundColor White
