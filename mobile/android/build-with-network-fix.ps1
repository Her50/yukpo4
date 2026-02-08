# Script PowerShell pour builder avec les corrections réseau
# Usage: .\build-with-network-fix.ps1

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPOMNANG - BUILD AVEC CORRECTIONS RESEAU" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier qu'on est dans le bon dossier
if (-not (Test-Path "gradlew.bat")) {
    Write-Host "ERREUR : gradlew.bat non trouve" -ForegroundColor Red
    Write-Host "Executez ce script depuis le dossier mobile/android/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Nettoyage du cache Gradle..." -ForegroundColor Yellow
.\gradlew.bat clean --no-daemon

if ($LASTEXITCODE -ne 0) {
    Write-Host "ATTENTION : Le nettoyage a echoue, mais on continue..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Nettoyage du cache des dependances..." -ForegroundColor Yellow
.\gradlew.bat --refresh-dependencies --no-daemon --dry-run 2>&1 | Out-Null

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  LANCEMENT DU BUILD" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration appliquee :" -ForegroundColor White
Write-Host "  - Repositories alternatifs (Maven Central, Aliyun)" -ForegroundColor Gray
Write-Host "  - Timeouts reseau augmentes (120s)" -ForegroundColor Gray
Write-Host "  - Retries configures (5 tentatives)" -ForegroundColor Gray
Write-Host ""

$buildType = Read-Host "Type de build (debug/release) [debug]"
if ([string]::IsNullOrWhiteSpace($buildType)) {
    $buildType = "debug"
}

Write-Host ""
Write-Host "Lancement du build $buildType..." -ForegroundColor Green
Write-Host ""

if ($buildType -eq "debug") {
    .\gradlew.bat assembleDebug --no-daemon --stacktrace
} else {
    .\gradlew.bat assembleRelease --no-daemon --stacktrace
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  BUILD REUSSI !" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    
    if ($buildType -eq "debug") {
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    } else {
        $apkPath = "app\build\outputs\apk\release\app-release.apk"
    }
    
    if (Test-Path $apkPath) {
        $fullPath = (Resolve-Path $apkPath).Path
        Write-Host "APK genere : $fullPath" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Pour installer sur un appareil Android :" -ForegroundColor Yellow
        Write-Host "  adb install $apkPath" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  BUILD ECHOUE" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez :" -ForegroundColor Yellow
    Write-Host "  - Votre connexion internet" -ForegroundColor Gray
    Write-Host "  - Les logs ci-dessus pour les erreurs specifiques" -ForegroundColor Gray
    Write-Host "  - Que les repositories sont accessibles" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alternative : Utilisez EAS Build (build dans le cloud)" -ForegroundColor Cyan
    Write-Host "  cd .." -ForegroundColor White
    Write-Host "  eas build --platform android --profile preview" -ForegroundColor White
    exit 1
}



