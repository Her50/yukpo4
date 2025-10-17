# Script de correction du build Gradle pour Yukpomnang Mobile avec Kotlin 2.0.0
# Ce script nettoie les caches et regenere les plugins Expo correctement

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Correction Build avec Kotlin 2.0.0" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# 1. Arreter tous les demons Gradle
Write-Host "[1/8] Arret des demons Gradle..." -ForegroundColor Yellow
Set-Location android
if (Test-Path "gradlew.bat") {
    .\gradlew.bat --stop 2>$null
    Write-Host "  OK Demons Gradle arretes" -ForegroundColor Green
}
Set-Location ..

# 2. Nettoyer les caches Gradle
Write-Host "[2/8] Nettoyage du cache Gradle..." -ForegroundColor Yellow
$gradleCachePath = "$env:USERPROFILE\.gradle\caches"
if (Test-Path $gradleCachePath) {
    Remove-Item -Path $gradleCachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK Cache Gradle supprime" -ForegroundColor Green
}
else {
    Write-Host "  Pas de cache Gradle a supprimer" -ForegroundColor Gray
}

# 3. Nettoyer les builds Android
Write-Host "[3/8] Nettoyage des builds Android..." -ForegroundColor Yellow
$pathsToClean = @("android\.gradle", "android\build", "android\app\build", "android\app\.cxx")
foreach ($path in $pathsToClean) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  OK $path supprime" -ForegroundColor Green
    }
}

# 4. Nettoyer les caches Expo et Metro
Write-Host "[4/8] Nettoyage des caches Expo et Metro..." -ForegroundColor Yellow
$cachePaths = @("node_modules\.cache", ".expo")
foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "  OK Caches Expo/Metro supprimes" -ForegroundColor Green

# 5. Supprimer node_modules pour reinstallation propre
Write-Host "[5/8] Suppression de node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK node_modules supprime" -ForegroundColor Green
}

# 6. Supprimer package-lock pour eviter les conflits
Write-Host "[6/8] Suppression du package-lock.json..." -ForegroundColor Yellow
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "  OK package-lock.json supprime" -ForegroundColor Green
}

# 7. Reinstaller les dependances
Write-Host "[7/8] Reinstallation des dependances npm..." -ForegroundColor Yellow
Write-Host "  Cette etape peut prendre quelques minutes..." -ForegroundColor Gray
npm install --legacy-peer-deps
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK Dependances installees avec succes" -ForegroundColor Green
}
else {
    Write-Host "  Erreur lors de l installation des dependances" -ForegroundColor Red
    Write-Host "  Tentative avec --force..." -ForegroundColor Yellow
    npm install --force
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Echec de l installation" -ForegroundColor Red
        exit 1
    }
}

# 8. Verifier que les plugins Expo sont bien installes
Write-Host "[8/8] Verification des plugins Expo..." -ForegroundColor Yellow
$expoPluginPath = "node_modules\expo-modules-autolinking\android\expo-gradle-plugin"
if (Test-Path $expoPluginPath) {
    Write-Host "  OK Plugin Expo Gradle trouve a: $expoPluginPath" -ForegroundColor Green
}
else {
    Write-Host "  Plugin Expo Gradle introuvable!" -ForegroundColor Red
    Write-Host "  Chemin attendu: $expoPluginPath" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " Configuration terminee" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration appliquee:" -ForegroundColor Cyan
Write-Host "  Kotlin: 2.0.0" -ForegroundColor White
Write-Host "  Android Gradle Plugin: 8.3.0" -ForegroundColor White
Write-Host "  Gradle: 8.3" -ForegroundColor White
Write-Host "  compileSdk: 34" -ForegroundColor White
Write-Host "  targetSdk: 34" -ForegroundColor White
Write-Host ""
Write-Host "Pour lancer le build:" -ForegroundColor Cyan
Write-Host "  cd android" -ForegroundColor White
Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor White
Write-Host ""
Write-Host "Ou utilisez:" -ForegroundColor Cyan
Write-Host "  npx expo run:android" -ForegroundColor White
Write-Host ""
