# Script de correction du build Gradle pour Yukpomnang Mobile
# Ce script nettoie les caches et corrige les problèmes de configuration

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Correction du Build Gradle" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 1. Nettoyer les caches Gradle
Write-Host "[1/6] Nettoyage du cache Gradle..." -ForegroundColor Yellow
if (Test-Path "$env:USERPROFILE\.gradle\caches") {
    Remove-Item -Path "$env:USERPROFILE\.gradle\caches" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Cache Gradle supprimé" -ForegroundColor Green
}

# 2. Nettoyer les builds Android
Write-Host "[2/6] Nettoyage des builds Android..." -ForegroundColor Yellow
if (Test-Path "android\.gradle") {
    Remove-Item -Path "android\.gradle" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path "android\build") {
    Remove-Item -Path "android\build" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path "android\app\build") {
    Remove-Item -Path "android\app\build" -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  ✓ Dossiers de build supprimés" -ForegroundColor Green

# 3. Nettoyer les caches node_modules d'Expo
Write-Host "[3/6] Nettoyage du cache Expo..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Path "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".expo") {
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  ✓ Cache Expo supprimé" -ForegroundColor Green

# 4. Nettoyer le cache Metro
Write-Host "[4/6] Nettoyage du cache Metro..." -ForegroundColor Yellow
if (Test-Path "$env:LOCALAPPDATA\Temp\metro-*") {
    Remove-Item -Path "$env:LOCALAPPDATA\Temp\metro-*" -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path "$env:LOCALAPPDATA\Temp\haste-map-*") {
    Remove-Item -Path "$env:LOCALAPPDATA\Temp\haste-map-*" -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  ✓ Cache Metro supprimé" -ForegroundColor Green

# 5. Réinstaller les dépendances critiques
Write-Host "[5/6] Réinstallation des dépendances critiques..." -ForegroundColor Yellow
Write-Host "  → Suppression de node_modules..." -ForegroundColor Gray
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  → Installation des dépendances..." -ForegroundColor Gray
npm install --legacy-peer-deps
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Dépendances installées" -ForegroundColor Green
} else {
    Write-Host "  ✗ Erreur lors de l'installation" -ForegroundColor Red
    exit 1
}

# 6. Nettoyer Gradle une dernière fois
Write-Host "[6/6] Nettoyage final de Gradle..." -ForegroundColor Yellow
Set-Location android
if (Test-Path "gradlew.bat") {
    .\gradlew.bat clean --no-daemon
    Write-Host "  ✓ Gradle clean exécuté" -ForegroundColor Green
}
Set-Location ..

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " ✓ Nettoyage terminé avec succès" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez maintenant lancer le build avec:" -ForegroundColor Cyan
Write-Host "  cd android && .\gradlew.bat assembleDebug" -ForegroundColor White
Write-Host ""

