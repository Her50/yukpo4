# Script de configuration des variables d'environnement Android pour Windows
# À exécuter après l'installation d'Android Studio

Write-Host "🔧 Configuration de l'environnement Android..." -ForegroundColor Cyan

# Chemins par défaut
$ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$JAVA_HOME = "C:\Program Files\Java\jdk-21"

# Vérifier si le SDK Android existe
if (-Not (Test-Path $ANDROID_HOME)) {
    Write-Host "❌ Android SDK non trouvé à : $ANDROID_HOME" -ForegroundColor Red
    $customPath = Read-Host "Entrez le chemin du SDK Android (ou laissez vide pour annuler)"
    if ($customPath) {
        $ANDROID_HOME = $customPath
    } else {
        Write-Host "Installation annulée." -ForegroundColor Yellow
        exit 1
    }
}

# Vérifier si Java existe
$javaVersion = java -version 2>&1 | Select-String -Pattern "version"
if ($javaVersion) {
    Write-Host "✅ Java détecté : $javaVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Java non trouvé" -ForegroundColor Red
    exit 1
}

# Définir les variables d'environnement utilisateur de manière permanente
Write-Host "📝 Configuration des variables d'environnement..." -ForegroundColor Cyan

# ANDROID_HOME
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $ANDROID_HOME, [System.EnvironmentVariableTarget]::User)
Write-Host "✅ ANDROID_HOME défini à : $ANDROID_HOME" -ForegroundColor Green

# JAVA_HOME (si pas déjà défini)
if (-Not $env:JAVA_HOME) {
    # Trouver Java automatiquement
    $javaPath = (Get-Command java).Source
    $javaHome = Split-Path (Split-Path $javaPath -Parent) -Parent
    [System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, [System.EnvironmentVariableTarget]::User)
    Write-Host "✅ JAVA_HOME défini à : $javaHome" -ForegroundColor Green
}

# Ajouter les chemins Android au PATH
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

$pathsToAdd = @(
    "$ANDROID_HOME\platform-tools",
    "$ANDROID_HOME\tools",
    "$ANDROID_HOME\tools\bin",
    "$ANDROID_HOME\emulator"
)

$newPath = $currentPath
foreach ($path in $pathsToAdd) {
    if ($currentPath -notlike "*$path*") {
        $newPath = "$newPath;$path"
        Write-Host "➕ Ajout au PATH : $path" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Déjà dans PATH : $path" -ForegroundColor Gray
    }
}

if ($newPath -ne $currentPath) {
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, [System.EnvironmentVariableTarget]::User)
    Write-Host "✅ PATH mis à jour" -ForegroundColor Green
}

# Mettre à jour les variables d'environnement de la session actuelle
$env:ANDROID_HOME = $ANDROID_HOME
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)

Write-Host ""
Write-Host "✨ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Variables configurées :" -ForegroundColor Cyan
Write-Host "  ANDROID_HOME = $env:ANDROID_HOME"
Write-Host "  JAVA_HOME = $env:JAVA_HOME"
Write-Host ""
Write-Host "⚠️  Important : Redémarrez votre terminal pour que les changements prennent effet" -ForegroundColor Yellow
Write-Host ""

# Vérifier les outils Android
Write-Host "🔍 Vérification des outils Android..." -ForegroundColor Cyan

$tools = @{
    "adb" = "$ANDROID_HOME\platform-tools\adb.exe"
    "sdkmanager" = "$ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat"
    "avdmanager" = "$ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat"
}

foreach ($tool in $tools.GetEnumerator()) {
    if (Test-Path $tool.Value) {
        Write-Host "  ✅ $($tool.Key) trouvé" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $($tool.Key) non trouvé (peut nécessiter configuration dans Android Studio)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎯 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "  1. Redémarrez votre terminal PowerShell"
Write-Host "  2. Allez dans le dossier mobile : cd mobile"
Write-Host "  3. Installez les dépendances : npm install"
Write-Host "  4. Préparez le projet : npx expo prebuild"
Write-Host "  5. Lancez la compilation : npx expo run:android"
Write-Host ""

