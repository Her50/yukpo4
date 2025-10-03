# 🚀 Script de build final pour corriger le crash Metro
Write-Host "BUILD FINAL - CORRECTION CRASH METRO" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Verifier que nous sommes dans le bon repertoire
if (-not (Test-Path "app.json")) {
    Write-Host "Erreur: app.json non trouve. Executez ce script depuis le dossier mobile/" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration actuelle:" -ForegroundColor Yellow
Write-Host "- Profil: standalone (pas de Metro)" -ForegroundColor White
Write-Host "- Mode: production" -ForegroundColor White
Write-Host "- Bundle: integre dans l'APK" -ForegroundColor White

# Option 1: Build avec profil standalone
Write-Host "`nOption 1: Build standalone (recommandee)" -ForegroundColor Green
Write-Host "Cette option cree un APK qui ne tente pas de se connecter a Metro" -ForegroundColor White
$choice1 = Read-Host "Voulez-vous lancer ce build? (o/n)"

if ($choice1 -eq "o" -or $choice1 -eq "O") {
    Write-Host "Lancement du build standalone..." -ForegroundColor Yellow
    npx eas build --platform android --profile standalone --clear-cache
    exit $LASTEXITCODE
}

# Option 2: Build avec profil production
Write-Host "`nOption 2: Build production" -ForegroundColor Green
Write-Host "Cette option utilise le profil production standard" -ForegroundColor White
$choice2 = Read-Host "Voulez-vous essayer ce build? (o/n)"

if ($choice2 -eq "o" -or $choice2 -eq "O") {
    Write-Host "Lancement du build production..." -ForegroundColor Yellow
    npx eas build --platform android --profile production --clear-cache
    exit $LASTEXITCODE
}

# Option 3: Build avec profil final
Write-Host "`nOption 3: Build final" -ForegroundColor Green
Write-Host "Cette option utilise le profil final optimise" -ForegroundColor White
$choice3 = Read-Host "Voulez-vous essayer ce build? (o/n)"

if ($choice3 -eq "o" -or $choice3 -eq "O") {
    Write-Host "Lancement du build final..." -ForegroundColor Yellow
    npx eas build --platform android --profile final --clear-cache
    exit $LASTEXITCODE
}

Write-Host "Aucun build lance. Utilisez 'npx eas build --platform android --profile standalone' pour lancer manuellement." -ForegroundColor Yellow

