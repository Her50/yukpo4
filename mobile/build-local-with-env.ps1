# Script PowerShell pour builder avec les variables d'environnement
# Usage: .\build-local-with-env.ps1 [debug|release]

param(
    [string]$BuildType = "debug"
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPOMNANG - BUILD LOCAL AVEC VARIABLES ENV" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables d'environnement depuis .env si disponible
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Write-Host "Chargement des variables depuis .env..." -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "  $key = $value" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "Fichier .env non trouve, utilisation des variables systeme..." -ForegroundColor Yellow
    Write-Host "Pour charger les variables depuis un fichier, creez .env a partir de .env.example" -ForegroundColor Yellow
}

# Variables par defaut si non definies
if (-not $env:EXPO_PUBLIC_API_URL) {
    $env:EXPO_PUBLIC_API_URL = "https://api.yukpomnang.com"
}
if (-not $env:EXPO_PUBLIC_WS_URL) {
    $env:EXPO_PUBLIC_WS_URL = "wss://api.yukpomnang.com"
}
if (-not $env:EXPO_PUBLIC_SHARE_URL) {
    $env:EXPO_PUBLIC_SHARE_URL = "https://yukpomnang.com"
}
if (-not $env:EXPO_PUBLIC_ENVIRONMENT) {
    $env:EXPO_PUBLIC_ENVIRONMENT = "production"
}

Write-Host ""
Write-Host "Variables d'environnement configurees :" -ForegroundColor Cyan
Write-Host "  EXPO_PUBLIC_API_URL = $env:EXPO_PUBLIC_API_URL" -ForegroundColor White
Write-Host "  EXPO_PUBLIC_WS_URL = $env:EXPO_PUBLIC_WS_URL" -ForegroundColor White
Write-Host "  EXPO_PUBLIC_SHARE_URL = $env:EXPO_PUBLIC_SHARE_URL" -ForegroundColor White
Write-Host "  EXPO_PUBLIC_ENVIRONMENT = $env:EXPO_PUBLIC_ENVIRONMENT" -ForegroundColor White
Write-Host ""

# Lancer le build
Write-Host "Lancement du build $BuildType..." -ForegroundColor Green
Write-Host ""

cd android

if ($BuildType -eq "release") {
    .\gradlew.bat assembleRelease --no-daemon
} else {
    .\gradlew.bat assembleDebug --no-daemon
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  BUILD REUSSI !" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    
    if ($BuildType -eq "debug") {
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    } else {
        $apkPath = "app\build\outputs\apk\release\app-release.apk"
    }
    
    if (Test-Path $apkPath) {
        $fullPath = (Resolve-Path $apkPath).Path
        $size = (Get-Item $apkPath).Length / 1MB
        Write-Host "APK genere : $fullPath" -ForegroundColor Cyan
        Write-Host "Taille : $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "  BUILD ECHOUE" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 1
}



