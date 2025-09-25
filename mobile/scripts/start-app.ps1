# Script simple pour démarrer l'application mobile

param(
    [switch]$Transform,
    [switch]$Clean
)

$MobilePath = Join-Path $PSScriptRoot ".."

Write-Host "🚀 Démarrage de l'application mobile Yukpo" -ForegroundColor Cyan

# Nettoyage si demandé
if ($Clean) {
    Write-Host "🧹 Nettoyage..." -ForegroundColor Yellow
    if (Test-Path (Join-Path $MobilePath "node_modules")) {
        Remove-Item (Join-Path $MobilePath "node_modules") -Recurse -Force
    }
}

# Transformation si demandée
if ($Transform) {
    Write-Host "🔄 Transformation du frontend..." -ForegroundColor Yellow
    $TransformScript = Join-Path $PSScriptRoot "auto-transform.ps1"
    if (Test-Path $TransformScript) {
        & $TransformScript
    }
}

# Aller dans le dossier mobile
Set-Location $MobilePath

# Installer les dépendances si nécessaire
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
    npm install
}

# Démarrer l'application
Write-Host "🚀 Démarrage de l'application..." -ForegroundColor Green
npx expo start