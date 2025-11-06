# Script automatisé de build Android pour Yukpomnang
# Ce script compile l'application Android en local

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release", "bundle")]
    [string]$BuildType = "debug",
    
    [Parameter(Mandatory=$false)]
    [switch]$Clean,
    
    [Parameter(Mandatory=$false)]
    [switch]$Install,
    
    [Parameter(Mandatory=$false)]
    [switch]$Run
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Build Android - Yukpomnang Mobile`n" -ForegroundColor Cyan

# Fonction pour vérifier les prérequis
function Test-Prerequisites {
    Write-Host "🔍 Vérification des prérequis..." -ForegroundColor Cyan
    
    # Vérifier Java
    try {
        $javaVersion = java -version 2>&1 | Select-String -Pattern "version"
        Write-Host "  ✅ Java installé: $javaVersion" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Java non trouvé. Installez Java JDK 17 ou supérieur" -ForegroundColor Red
        exit 1
    }
    
    # Vérifier ANDROID_HOME
    if (-Not $env:ANDROID_HOME) {
        Write-Host "  ❌ ANDROID_HOME non défini" -ForegroundColor Red
        Write-Host "     Exécutez: .\scripts\setup-android-env.ps1" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  ✅ ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
    
    # Vérifier node_modules
    if (-Not (Test-Path "node_modules")) {
        Write-Host "  ⚠️  node_modules non trouvé. Installation des dépendances..." -ForegroundColor Yellow
        npm install
    } else {
        Write-Host "  ✅ Dependencies installées" -ForegroundColor Green
    }
    
    # Vérifier le dossier android
    if (-Not (Test-Path "android")) {
        Write-Host "  ⚠️  Dossier android non trouvé. Exécution de prebuild..." -ForegroundColor Yellow
        npx expo prebuild --platform android
    } else {
        Write-Host "  ✅ Dossier android présent" -ForegroundColor Green
    }
    
    Write-Host ""
}

# Fonction de nettoyage
function Invoke-Clean {
    Write-Host "🧹 Nettoyage des builds précédents..." -ForegroundColor Cyan
    
    if (Test-Path "android\app\build") {
        Remove-Item -Recurse -Force "android\app\build"
        Write-Host "  ✅ Build Android nettoyé" -ForegroundColor Green
    }
    
    if (Test-Path "android\.gradle") {
        Remove-Item -Recurse -Force "android\.gradle"
        Write-Host "  ✅ Cache Gradle nettoyé" -ForegroundColor Green
    }
    
    # Nettoyer Metro bundler cache
    npx expo start --clear
    Write-Host "  ✅ Cache Metro nettoyé" -ForegroundColor Green
    
    Write-Host ""
}

# Fonction de build
function Invoke-Build {
    param([string]$Type)
    
    Write-Host "🔨 Compilation de l'application ($Type)..." -ForegroundColor Cyan
    Write-Host "   Cela peut prendre 5-15 minutes selon votre machine`n" -ForegroundColor Gray
    
    Push-Location android
    
    try {
        switch ($Type) {
            "debug" {
                Write-Host "📱 Build Debug APK..." -ForegroundColor Yellow
                .\gradlew assembleDebug
                $outputPath = "app\build\outputs\apk\debug\app-debug.apk"
            }
            "release" {
                Write-Host "📱 Build Release APK..." -ForegroundColor Yellow
                .\gradlew assembleRelease
                $outputPath = "app\build\outputs\apk\release\app-release.apk"
            }
            "bundle" {
                Write-Host "📦 Build Release Bundle (AAB)..." -ForegroundColor Yellow
                .\gradlew bundleRelease
                $outputPath = "app\build\outputs\bundle\release\app-release.aab"
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Build réussi!`n" -ForegroundColor Green
            
            if (Test-Path $outputPath) {
                $fullPath = (Resolve-Path $outputPath).Path
                $size = [math]::Round((Get-Item $fullPath).Length / 1MB, 2)
                
                Write-Host "📄 Fichier généré:" -ForegroundColor Cyan
                Write-Host "   Chemin: $fullPath" -ForegroundColor White
                Write-Host "   Taille: $size MB`n" -ForegroundColor White
                
                return $fullPath
            }
        } else {
            Write-Host "`n❌ Erreur de build (code: $LASTEXITCODE)" -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# Fonction d'installation sur appareil/émulateur
function Install-App {
    param([string]$ApkPath)
    
    Write-Host "📲 Installation de l'application..." -ForegroundColor Cyan
    
    # Vérifier si un appareil est connecté
    $devices = adb devices | Select-String -Pattern "device$"
    
    if ($devices.Count -eq 0) {
        Write-Host "  ❌ Aucun appareil/émulateur détecté" -ForegroundColor Red
        Write-Host "     Connectez un appareil ou lancez un émulateur" -ForegroundColor Yellow
        return
    }
    
    Write-Host "  Appareils détectés: $($devices.Count)" -ForegroundColor Gray
    
    adb install -r $ApkPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Application installée avec succès`n" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Erreur lors de l'installation" -ForegroundColor Red
    }
}

# Fonction pour lancer l'app
function Start-App {
    Write-Host "🚀 Lancement de l'application..." -ForegroundColor Cyan
    
    $packageName = "com.yukpomnang.mobile"
    $mainActivity = "$packageName/.MainActivity"
    
    adb shell am start -n $mainActivity
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Application lancée`n" -ForegroundColor Green
        
        # Afficher les logs
        Write-Host "📋 Logs de l'application (Ctrl+C pour arrêter):" -ForegroundColor Cyan
        adb logcat -s ReactNativeJS:V ReactNative:V *:E
    } else {
        Write-Host "  ❌ Erreur lors du lancement" -ForegroundColor Red
    }
}

# Main script
try {
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Nettoyer si demandé
    if ($Clean) {
        Invoke-Clean
    }
    
    # Build
    $apkPath = Invoke-Build -Type $BuildType
    
    # Installer si demandé
    if ($Install -and $BuildType -ne "bundle") {
        Install-App -ApkPath $apkPath
    }
    
    # Lancer si demandé
    if ($Run -and $BuildType -ne "bundle") {
        Start-App
    }
    
    Write-Host "✨ Processus terminé avec succès!`n" -ForegroundColor Green
    
    # Afficher les prochaines étapes
    Write-Host "🎯 Prochaines étapes:" -ForegroundColor Cyan
    if (-Not $Install) {
        Write-Host "   Pour installer: .\build-android.ps1 -BuildType $BuildType -Install" -ForegroundColor White
    }
    if (-Not $Run -and $BuildType -ne "bundle") {
        Write-Host "   Pour lancer: .\build-android.ps1 -BuildType $BuildType -Install -Run" -ForegroundColor White
    }
    if ($BuildType -eq "bundle") {
        Write-Host "   L'AAB est prêt pour Google Play Store" -ForegroundColor White
    }
    Write-Host ""
    
} catch {
    Write-Host "`n❌ Erreur: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}

