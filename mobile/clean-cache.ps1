# Script de nettoyage complet des caches pour Yukpomnang Mobile
# Ce script nettoie tous les caches qui peuvent causer des problèmes de build

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Nettoyage Complet des Caches" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# 1. Arrêter tous les daemons Gradle
Write-Host "[1/8] Arrêt des daemons Gradle..." -ForegroundColor Yellow
if (Test-Path "android\gradlew.bat") {
    Set-Location android
    .\gradlew.bat --stop 2>$null
    Set-Location ..
    Write-Host "  ✓ Daemons Gradle arrêtés" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Gradle wrapper non trouvé (normal si pas encore prébuild)" -ForegroundColor Gray
}

# 2. Nettoyer le cache Gradle (CRITIQUE)
Write-Host "[2/8] Nettoyage du cache Gradle..." -ForegroundColor Yellow
$gradleCachePath = "$env:USERPROFILE\.gradle\caches"
$gradleDaemonPath = "$env:USERPROFILE\.gradle\daemon"
if (Test-Path $gradleCachePath) {
    Remove-Item -Path $gradleCachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Cache Gradle supprimé" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Pas de cache Gradle à supprimer" -ForegroundColor Gray
}
if (Test-Path $gradleDaemonPath) {
    Remove-Item -Path $gradleDaemonPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Daemon Gradle supprimé" -ForegroundColor Green
}

# 3. Nettoyer les builds Android locaux
Write-Host "[3/8] Nettoyage des builds Android..." -ForegroundColor Yellow
$pathsToClean = @("android\.gradle", "android\build", "android\app\build", "android\app\.cxx")
$cleaned = 0
foreach ($path in $pathsToClean) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        $cleaned++
    }
}
if ($cleaned -gt 0) {
    Write-Host "  ✓ $cleaned dossier(s) de build supprimé(s)" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Pas de dossiers de build à supprimer" -ForegroundColor Gray
}

# 4. Nettoyer le cache npm
Write-Host "[4/8] Nettoyage du cache npm..." -ForegroundColor Yellow
try {
    npm cache clean --force 2>$null
    Write-Host "  ✓ Cache npm nettoyé" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Erreur lors du nettoyage du cache npm (non critique)" -ForegroundColor Yellow
}

# 5. Nettoyer node_modules (optionnel - demander confirmation)
Write-Host "[5/8] Nettoyage de node_modules..." -ForegroundColor Yellow
$response = Read-Host "  Voulez-vous supprimer node_modules ? (O/N)"
if ($response -eq "O" -or $response -eq "o" -or $response -eq "Y" -or $response -eq "y") {
    if (Test-Path "node_modules") {
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ node_modules supprimé" -ForegroundColor Green
        Write-Host "  ⚠ Vous devrez exécuter 'npm install' après" -ForegroundColor Yellow
    } else {
        Write-Host "  ⚠ node_modules n'existe pas" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⏭ node_modules conservé" -ForegroundColor Gray
}

# 6. Nettoyer les caches Expo et Metro
Write-Host "[6/8] Nettoyage des caches Expo et Metro..." -ForegroundColor Yellow
$cachePaths = @("node_modules\.cache", ".expo")
$cleaned = 0
foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        $cleaned++
    }
}
if ($cleaned -gt 0) {
    Write-Host "  ✓ $cleaned cache(s) Expo/Metro supprimé(s)" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Pas de caches Expo/Metro à supprimer" -ForegroundColor Gray
}

# 7. Nettoyer le cache Metro temporaire
Write-Host "[7/8] Nettoyage du cache Metro temporaire..." -ForegroundColor Yellow
$metroCachePaths = @(
    "$env:LOCALAPPDATA\Temp\metro-*",
    "$env:LOCALAPPDATA\Temp\haste-map-*"
)
$cleaned = 0
foreach ($pattern in $metroCachePaths) {
    $items = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    if ($items) {
        $items | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $cleaned += $items.Count
    }
}
if ($cleaned -gt 0) {
    Write-Host "  ✓ $cleaned fichier(s) Metro temporaire(s) supprimé(s)" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Pas de fichiers Metro temporaires à supprimer" -ForegroundColor Gray
}

# 8. Vérifier que les patches existent
Write-Host "[8/8] Vérification des patches..." -ForegroundColor Yellow
if (Test-Path "patches") {
    $patchCount = (Get-ChildItem -Path "patches" -Filter "*.patch" -ErrorAction SilentlyContinue).Count
    if ($patchCount -gt 0) {
        Write-Host "  ✓ $patchCount patch(s) trouvé(s)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Aucun patch trouvé dans le dossier patches/" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠ Dossier patches/ non trouvé" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Nettoyage Terminé !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Afficher les prochaines étapes
Write-Host "Prochaines étapes :" -ForegroundColor Yellow
Write-Host "  1. Si vous avez supprimé node_modules, exécutez : npm install" -ForegroundColor White
Write-Host "  2. Appliquez les patches : npx patch-package" -ForegroundColor White
Write-Host "  3. Vérifiez que compileSdkVersion est présent :" -ForegroundColor White
Write-Host "     Select-String -Path 'node_modules\expo-modules-core\android\build.gradle' -Pattern 'compileSdkVersion'" -ForegroundColor Gray
Write-Host "  4. Lancez le build : npx eas build --platform android --profile preview" -ForegroundColor White
Write-Host ""


