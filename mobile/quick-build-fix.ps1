# Build rapide pour corriger le crash Metro
Write-Host "BUILD RAPIDE - CORRECTION CRASH METRO" -ForegroundColor Cyan

# Verifier EAS CLI
if (-not (Get-Command "npx" -ErrorAction SilentlyContinue)) {
    Write-Host "npx non trouve. Installez Node.js d'abord." -ForegroundColor Red
    exit 1
}

# Nettoyer
Write-Host "Nettoyage..." -ForegroundColor Yellow
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" }

# Build avec profil standalone (le plus sur)
Write-Host "Build standalone (pas de Metro)..." -ForegroundColor Yellow
npx eas build --platform android --profile standalone --local --clear-cache

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build reussi! L'APK ne devrait plus crasher." -ForegroundColor Green
} else {
    Write-Host "Erreur de build. Essayez le script complet." -ForegroundColor Red
}
