# Script pour tester que les modifications sont bien en place
Write-Host "🔍 Vérification des Modifications de Connexion" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

# Vérifier AuthContext.tsx
Write-Host "`n📁 Vérification de AuthContext.tsx..." -ForegroundColor Yellow

$authContextContent = Get-Content "src/contexts/AuthContext.tsx" -Raw

$checks = @{
    "forceRender state" = $authContextContent -match "useState.*forceRender"
    "setForceRender après setUser" = $authContextContent -match "setForceRender.*prev.*prev \+ 1"
    "Nom par défaut depuis email" = $authContextContent -match "email\.split\('@'\)\[0\]"
    "Logs détaillés" = $authContextContent -match "═══ État actuel ═══"
}

$authSuccess = $true
foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "  ✅ $($check.Key)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Key) - MANQUANT" -ForegroundColor Red
        $authSuccess = $false
    }
}

# Vérifier AppNavigator.tsx
Write-Host "`n📁 Vérification de AppNavigator.tsx..." -ForegroundColor Yellow

$navigatorContent = Get-Content "src/navigation/AppNavigator.tsx" -Raw

$navChecks = @{
    "navigationKey state" = $navigatorContent -match "useState.*navigationKey"
    "setNavigationKey dans useEffect" = $navigatorContent -match "setNavigationKey.*prev.*prev \+ 1"
    "Key sur MainStack" = $navigatorContent -match "MainStack.*key=.*main.*navigationKey"
    "Key sur AuthStack" = $navigatorContent -match "AuthStack.*key=.*auth.*navigationKey"
    "Logs détaillés navigation" = $navigatorContent -match "═════════════════════════════════════"
}

$navSuccess = $true
foreach ($check in $navChecks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "  ✅ $($check.Key)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Key) - MANQUANT" -ForegroundColor Red
        $navSuccess = $false
    }
}

# Résumé
Write-Host "`n═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

if ($authSuccess -and $navSuccess) {
    Write-Host "`n✅ Toutes les modifications sont en place !" -ForegroundColor Green
    Write-Host "`n🚀 Prêt à tester ! Lancez : npx expo start --clear" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  Certaines modifications sont manquantes" -ForegroundColor Yellow
    Write-Host "Vérifiez que les fichiers ont bien été sauvegardés." -ForegroundColor Yellow
}

Write-Host "`n═══════════════════════════════════════════════════`n" -ForegroundColor Cyan


