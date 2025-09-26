# Script simple pour tester l'authentification mobile
param(
    [switch]$SkipBuild,
    [switch]$GenerateReport
)

Write-Host "=== Test Mobile Yukpo ===" -ForegroundColor Green

# Test d'authentification
Write-Host "Lancement des tests d'authentification..." -ForegroundColor Blue
$authResult = node scripts/test-auth-mobile.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "Tests d'authentification: REUSSIS" -ForegroundColor Green
    $authSuccess = $true
} else {
    Write-Host "Tests d'authentification: ECHOUES" -ForegroundColor Red
    $authSuccess = $false
}

# Test des fonctionnalités
Write-Host "Lancement des tests de fonctionnalites..." -ForegroundColor Blue
$featureResult = node scripts/test-mobile-features.js
if ($LASTEXITCODE -eq 0) {
    Write-Host "Tests de fonctionnalites: REUSSIS" -ForegroundColor Green
    $featureSuccess = $true
} else {
    Write-Host "Tests de fonctionnalites: ECHOUES" -ForegroundColor Red
    $featureSuccess = $false
}

# Résumé
Write-Host "=== RESUME ===" -ForegroundColor Yellow
Write-Host "Authentification: $(if ($authSuccess) { 'REUSSI' } else { 'ECHOUE' })" -ForegroundColor $(if ($authSuccess) { 'Green' } else { 'Red' })
Write-Host "Fonctionnalites: $(if ($featureSuccess) { 'REUSSI' } else { 'ECHOUE' })" -ForegroundColor $(if ($featureSuccess) { 'Green' } else { 'Red' })

if ($authSuccess -and $featureSuccess) {
    Write-Host "TOUS LES TESTS SONT PASSES!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "CERTAINS TESTS ONT ECHOUE" -ForegroundColor Red
    exit 1
}

