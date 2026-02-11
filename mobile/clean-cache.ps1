# Script de nettoyage du cache pour l'application mobile Yukpo

Write-Host "🧹 Nettoyage du cache en cours..." -ForegroundColor Yellow

# Nettoyer le cache Expo
if (Test-Path .expo) {
    Remove-Item -Recurse -Force .expo
    Write-Host "✅ Cache .expo supprimé" -ForegroundColor Green
}

# Nettoyer le cache node_modules
if (Test-Path node_modules\.cache) {
    Remove-Item -Recurse -Force node_modules\.cache
    Write-Host "✅ Cache node_modules supprimé" -ForegroundColor Green
}

# Nettoyer le cache Android Gradle
if (Test-Path android\.gradle) {
    Remove-Item -Recurse -Force android\.gradle
    Write-Host "✅ Cache Android Gradle supprimé" -ForegroundColor Green
}

# Nettoyer le cache build Android
if (Test-Path android\app\build) {
    Remove-Item -Recurse -Force android\app\build
    Write-Host "✅ Cache build Android (app) supprimé" -ForegroundColor Green
}

if (Test-Path android\build) {
    Remove-Item -Recurse -Force android\build
    Write-Host "✅ Cache build Android (racine) supprimé" -ForegroundColor Green
}

# Nettoyer le cache build iOS
if (Test-Path ios\build) {
    Remove-Item -Recurse -Force ios\build
    Write-Host "✅ Cache build iOS supprimé" -ForegroundColor Green
}

# Nettoyer le cache Metro
if (Test-Path .metro) {
    Remove-Item -Recurse -Force .metro
    Write-Host "✅ Cache Metro supprimé" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Nettoyage terminé !" -ForegroundColor Green
Write-Host ""
Write-Host "Pour relancer l'application avec cache propre:" -ForegroundColor Cyan
Write-Host "  npx expo start --clear" -ForegroundColor White
Write-Host ""
