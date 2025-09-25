# Script simple de build automatique

param(
    [switch]$Clean,
    [switch]$Transform,
    [switch]$Install,
    [switch]$Build,
    [string]$Platform = "android"
)

$MobilePath = Join-Path $PSScriptRoot ".."

Write-Host "Build automatique mobile" -ForegroundColor Cyan
Write-Host "Plateforme: $Platform" -ForegroundColor Yellow

# Nettoyage si demande
if ($Clean) {
    Write-Host "Nettoyage..." -ForegroundColor Yellow
    if (Test-Path (Join-Path $MobilePath "node_modules")) {
        Remove-Item (Join-Path $MobilePath "node_modules") -Recurse -Force
    }
}

# Transformation si demandee
if ($Transform) {
    Write-Host "Transformation du frontend..." -ForegroundColor Yellow
    $TransformScript = Join-Path $PSScriptRoot "transform-simple.ps1"
    if (Test-Path $TransformScript) {
        & $TransformScript
    }
}

# Aller dans le dossier mobile
Set-Location $MobilePath

# Installation des dependances si demandee
if ($Install) {
    Write-Host "Installation des dependances..." -ForegroundColor Yellow
    npm install
    npx expo install --fix
}

# Build si demande
if ($Build) {
    Write-Host "Build de l'application..." -ForegroundColor Yellow
    
    if ($Platform -eq "android") {
        Write-Host "Build Android..." -ForegroundColor Yellow
        npx expo build:android --type apk
    } elseif ($Platform -eq "ios") {
        Write-Host "Build iOS..." -ForegroundColor Yellow
        npx expo build:ios
    } else {
        Write-Host "Plateforme non supportee: $Platform" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Processus termine!" -ForegroundColor Green

