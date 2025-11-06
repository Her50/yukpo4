# Script post-installation Android Studio
# À exécuter APRÈS avoir installé Android Studio

param(
    [Parameter(Mandatory = $false)]
    [string]$AndroidHome = "$env:LOCALAPPDATA\Android\Sdk"
)

Write-Host "`n🔧 Configuration post-installation Android Studio`n" -ForegroundColor Cyan

# Vérifier si Android Studio est installé
$studioPath = "C:\Program Files\Android\Android Studio"
if (-Not (Test-Path $studioPath)) {
    Write-Host "⚠️  Android Studio non trouvé à: $studioPath" -ForegroundColor Yellow
    Write-Host "   Si vous l'avez installé ailleurs, c'est OK, continuons..." -ForegroundColor Gray
}

# Vérifier si le SDK existe
if (-Not (Test-Path $AndroidHome)) {
    Write-Host "⚠️  Android SDK non trouvé à: $AndroidHome" -ForegroundColor Yellow
    Write-Host "   Le SDK sera créé au premier lancement d'Android Studio" -ForegroundColor Gray
    Write-Host "`n📋 INSTRUCTIONS:" -ForegroundColor Cyan
    Write-Host "   1. Lancez Android Studio" -ForegroundColor White
    Write-Host "   2. Suivez l'assistant de configuration" -ForegroundColor White
    Write-Host "   3. Laissez-le télécharger le SDK" -ForegroundColor White
    Write-Host "   4. Revenez exécuter ce script`n" -ForegroundColor White
    
    $continue = Read-Host "Avez-vous déjà lancé Android Studio et configuré le SDK? (o/N)"
    if ($continue -ne "o" -and $continue -ne "O") {
        Write-Host "`n⏸️  OK, lancez d'abord Android Studio, puis revenez!`n" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "✅ Android SDK trouvé: $AndroidHome`n" -ForegroundColor Green

# Configurer les variables d'environnement
Write-Host "📝 Configuration des variables d'environnement...`n" -ForegroundColor Cyan

# ANDROID_HOME
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $AndroidHome, [System.EnvironmentVariableTarget]::User)
Write-Host "  ✅ ANDROID_HOME = $AndroidHome" -ForegroundColor Green

# ANDROID_SDK_ROOT (alias)
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $AndroidHome, [System.EnvironmentVariableTarget]::User)
Write-Host "  ✅ ANDROID_SDK_ROOT = $AndroidHome" -ForegroundColor Green

# Ajouter au PATH
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
$pathsToAdd = @(
    "$AndroidHome\platform-tools",
    "$AndroidHome\emulator",
    "$AndroidHome\cmdline-tools\latest\bin"
)

$newPath = $currentPath
foreach ($path in $pathsToAdd) {
    if ($currentPath -notlike "*$path*") {
        $newPath = "$newPath;$path"
        Write-Host "  ➕ Ajouté au PATH: $path" -ForegroundColor Yellow
    }
    else {
        Write-Host "  ✓ Déjà dans PATH: $path" -ForegroundColor Gray
    }
}

if ($newPath -ne $currentPath) {
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, [System.EnvironmentVariableTarget]::User)
    Write-Host "`n✅ PATH mis à jour`n" -ForegroundColor Green
}
else {
    Write-Host "`n✓ PATH déjà configuré`n" -ForegroundColor Gray
}

# Rafraîchir les variables d'environnement de la session actuelle
$env:ANDROID_HOME = $AndroidHome
$env:ANDROID_SDK_ROOT = $AndroidHome
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

Write-Host "🔍 Vérification des outils Android...`n" -ForegroundColor Cyan

# Vérifier adb
$adbPath = "$AndroidHome\platform-tools\adb.exe"
if (Test-Path $adbPath) {
    $adbVersion = & $adbPath version 2>&1 | Select-Object -First 1
    Write-Host "  ✅ ADB: $adbVersion" -ForegroundColor Green
}
else {
    Write-Host "  ⚠️  ADB non trouvé (installer Platform Tools dans SDK Manager)" -ForegroundColor Yellow
}

# Vérifier sdkmanager
$sdkmanagerPath = "$AndroidHome\cmdline-tools\latest\bin\sdkmanager.bat"
if (Test-Path $sdkmanagerPath) {
    Write-Host "  ✅ sdkmanager trouvé" -ForegroundColor Green
    
    # Lister les packages installés
    Write-Host "`n📦 Packages SDK installés:" -ForegroundColor Cyan
    & $sdkmanagerPath --list_installed 2>$null | Select-Object -First 20
}
else {
    Write-Host "  ⚠️  sdkmanager non trouvé" -ForegroundColor Yellow
    Write-Host "     Installez 'Command-line Tools' dans Android Studio SDK Manager" -ForegroundColor Gray
}

Write-Host "`n✅ Configuration terminée!`n" -ForegroundColor Green

Write-Host "🎯 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Redémarrez votre terminal PowerShell" -ForegroundColor White
Write-Host "  2. Vérifiez: adb --version" -ForegroundColor White
Write-Host "  3. Allez dans mobile/: cd mobile" -ForegroundColor White
Write-Host "  4. Préparez le projet: npx expo prebuild" -ForegroundColor White
Write-Host "  5. Compilez: .\build-android.ps1 -BuildType debug`n" -ForegroundColor White

# Afficher un résumé
Write-Host "📋 RÉSUMÉ DE LA CONFIGURATION" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "ANDROID_HOME      : $env:ANDROID_HOME" -ForegroundColor White
Write-Host "ANDROID_SDK_ROOT  : $env:ANDROID_SDK_ROOT" -ForegroundColor White
Write-Host "Java Version      : $(java -version 2>&1 | Select-Object -First 1)" -ForegroundColor White
Write-Host "Node Version      : $(node --version 2>&1)" -ForegroundColor White
Write-Host "npm Version       : $(npm --version 2>&1)" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Gray

Write-Host "💡 ASTUCE: Si 'adb' ou 'sdkmanager' ne fonctionnent pas," -ForegroundColor Yellow
Write-Host "   redémarrez votre terminal ou ouvrez-en un nouveau!`n" -ForegroundColor Yellow

