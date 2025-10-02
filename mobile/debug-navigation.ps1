# Script de debug pour la navigation
Write-Host "Debug de la navigation dans l'application mobile..." -ForegroundColor Cyan

Write-Host "`n1. Verification des fichiers de navigation..." -ForegroundColor Yellow

# Verifier AppNavigator
$appNavigatorFile = "src/navigation/AppNavigator.tsx"
if (Test-Path $appNavigatorFile) {
    $content = Get-Content $appNavigatorFile -Raw
    if ($content -match "user.*loading" -and $content -match "AuthStack.*MainStack") {
        Write-Host "   ✅ AppNavigator configure correctement" -ForegroundColor Green
    } else {
        Write-Host "   ❌ AppNavigator mal configure" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ AppNavigator manquant" -ForegroundColor Red
}

# Verifier AuthContext
$authContextFile = "src/contexts/AuthContext.tsx"
if (Test-Path $authContextFile) {
    $content = Get-Content $authContextFile -Raw
    if ($content -match "setUser.*userData" -and $content -match "console.log.*AuthContext") {
        Write-Host "   ✅ AuthContext configure correctement" -ForegroundColor Green
    } else {
        Write-Host "   ❌ AuthContext mal configure" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ AuthContext manquant" -ForegroundColor Red
}

# Verifier LoginScreen
$loginScreenFile = "src/screens/auth/LoginScreen.tsx"
if (Test-Path $loginScreenFile) {
    $content = Get-Content $loginScreenFile -Raw
    if ($content -notmatch "showDebug" -and $content -notmatch "LogViewer") {
        Write-Host "   ✅ LoginScreen nettoye (debug supprime)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ LoginScreen contient encore du code debug" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ LoginScreen manquant" -ForegroundColor Red
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

Write-Host "`n3. Instructions de debug:" -ForegroundColor Cyan
Write-Host "   1. Lancez l'application: npm start" -ForegroundColor White
Write-Host "   2. Ouvrez la console de debug" -ForegroundColor White
Write-Host "   3. Tentez une connexion avec: test@example.com / test123" -ForegroundColor White
Write-Host "   4. Verifiez les logs [AuthContext] et [LoginScreen]" -ForegroundColor White
Write-Host "   5. Verifiez que setUser est appele avec les bonnes donnees" -ForegroundColor White

Write-Host "`n4. Points de verification:" -ForegroundColor Cyan
Write-Host "   - Les logs [AuthContext] s'affichent dans la console" -ForegroundColor White
Write-Host "   - La fonction login() ne lance pas d'erreur" -ForegroundColor White
Write-Host "   - setUser() est appele avec les donnees utilisateur" -ForegroundColor White
Write-Host "   - AppNavigator detecte le changement d'etat user" -ForegroundColor White
Write-Host "   - La navigation vers MainStack se fait automatiquement" -ForegroundColor White

Write-Host "`n5. Solutions possibles:" -ForegroundColor Cyan
Write-Host "   - Verifier que le token JWT est valide" -ForegroundColor White
Write-Host "   - S'assurer que setUser() est appele correctement" -ForegroundColor White
Write-Host "   - Verifier que AppNavigator reagit aux changements d'etat" -ForegroundColor White
Write-Host "   - Redemarrer l'application si necessaire" -ForegroundColor White
