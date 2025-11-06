# Script de configuration des variables d'environnement Android
# Configuration automatique après installation d'Android Studio

$ErrorActionPreference = "Stop"

Write-Host "`n🔧 Configuration de l'environnement Android`n" -ForegroundColor Cyan

# Chemin du SDK Android
$ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# Vérifier si le SDK existe
if (-Not (Test-Path $ANDROID_HOME)) {
    Write-Host "❌ Android SDK non trouvé à : $ANDROID_HOME" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Android SDK trouvé : $ANDROID_HOME`n" -ForegroundColor Green

# Configurer ANDROID_HOME
Write-Host "📝 Configuration des variables d'environnement...`n" -ForegroundColor Cyan

[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $ANDROID_HOME, [System.EnvironmentVariableTarget]::User)
Write-Host "  ✅ ANDROID_HOME = $ANDROID_HOME" -ForegroundColor Green

[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $ANDROID_HOME, [System.EnvironmentVariableTarget]::User)
Write-Host "  ✅ ANDROID_SDK_ROOT = $ANDROID_HOME" -ForegroundColor Green

# Ajouter au PATH
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
$pathsToAdd = @(
    "$ANDROID_HOME\platform-tools",
    "$ANDROID_HOME\emulator",
    "$ANDROID_HOME\cmdline-tools\latest\bin"
)

$newPath = $currentPath
$pathUpdated = $false

foreach ($path in $pathsToAdd) {
    if ($currentPath -notlike "*$path*") {
        $newPath = "$newPath;$path"
        Write-Host "  ➕ Ajouté au PATH : $path" -ForegroundColor Yellow
        $pathUpdated = $true
    }
    else {
        Write-Host "  ✓ Déjà dans PATH : $path" -ForegroundColor Gray
    }
}

if ($pathUpdated) {
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, [System.EnvironmentVariableTarget]::User)
    Write-Host "`n✅ PATH mis à jour`n" -ForegroundColor Green
}
else {
    Write-Host "`n✓ PATH déjà configuré`n" -ForegroundColor Gray
}

# Rafraîchir les variables de la session actuelle
$env:ANDROID_HOME = $ANDROID_HOME
$env:ANDROID_SDK_ROOT = $ANDROID_HOME
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

Write-Host "🔍 Vérification des outils...`n" -ForegroundColor Cyan

# Vérifier adb
$adbPath = "$ANDROID_HOME\platform-tools\adb.exe"
if (Test-Path $adbPath) {
    try {
        $adbVersion = & $adbPath version 2>&1 | Select-Object -First 1
        Write-Host "  ✅ ADB : $adbVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "  ⚠️  ADB installé mais erreur de version" -ForegroundColor Yellow
    }
}
else {
    Write-Host "  ❌ ADB non trouvé" -ForegroundColor Red
}

# Vérifier sdkmanager
$sdkmanagerPath = "$ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat"
if (Test-Path $sdkmanagerPath) {
    Write-Host "  ✅ sdkmanager installé" -ForegroundColor Green
}
else {
    Write-Host "  ❌ sdkmanager non trouvé" -ForegroundColor Red
}

# Vérifier Java
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "  ✅ Java : $javaVersion" -ForegroundColor Green
}
catch {
    Write-Host "  ❌ Java non trouvé" -ForegroundColor Red
}

# Vérifier Node
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node : $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "  ❌ Node non trouvé" -ForegroundColor Red
}

Write-Host "`n✨ Configuration terminée !`n" -ForegroundColor Green

Write-Host "📋 RÉSUMÉ DE LA CONFIGURATION" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "ANDROID_HOME      : $env:ANDROID_HOME" -ForegroundColor White
Write-Host "ANDROID_SDK_ROOT  : $env:ANDROID_SDK_ROOT" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

Write-Host "⚠️  IMPORTANT : Redémarrez votre terminal PowerShell" -ForegroundColor Yellow
Write-Host "   pour que les changements prennent effet !`n" -ForegroundColor Yellow

Write-Host "🎯 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "  1. Fermez ce terminal" -ForegroundColor White
Write-Host "  2. Ouvrez un nouveau PowerShell" -ForegroundColor White
Write-Host "  3. Testez : adb --version" -ForegroundColor White
Write-Host "  4. Allez dans mobile : cd mobile" -ForegroundColor White
Write-Host "  5. Installez les dépendances : npm install" -ForegroundColor White
Write-Host "  6. Préparez le projet : npx expo prebuild" -ForegroundColor White
Write-Host "  7. Compilez : cd .. ; .\mobile\build-android.ps1 -BuildType debug`n" -ForegroundColor White

