# Script simple pour demarrer l'application mobile

param(
    [switch]$Transform,
    [switch]$Clean
)

$MobilePath = Join-Path $PSScriptRoot ".."

Write-Host "Demarrage de l'application mobile Yukpo" -ForegroundColor Cyan

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

# Installer les dependances si necessaire
if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dependances..." -ForegroundColor Yellow
    npm install
}

# Demarrer l'application
Write-Host "Demarrage de l'application..." -ForegroundColor Green
npx expo start


