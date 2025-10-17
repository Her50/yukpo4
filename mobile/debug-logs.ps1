# Script pour capturer tous les logs de debug

Write-Host "📋 CAPTURE DES LOGS DE DEBUG" -ForegroundColor Cyan
Write-Host "Ce script capture tous les logs pour diagnostiquer le problème" -ForegroundColor Yellow
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = "debug-logs-$timestamp.txt"

Write-Host "Les logs seront sauvegardés dans: $logFile" -ForegroundColor Green
Write-Host ""

# Fonction pour logger
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
}

Write-Log "=== DÉBUT DE LA SESSION DE DEBUG ==="
Write-Log "System: $([System.Environment]::OSVersion.VersionString)"
Write-Log "Node version: $(node --version)"
Write-Log "NPM version: $(npm --version)"
Write-Log ""

Write-Log "--- Configuration Expo ---"
npx expo --version 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Log ""
Write-Log "--- Vérification des dépendances ---"
if (Test-Path "package.json") {
    Write-Log "✅ package.json trouvé"
} else {
    Write-Log "❌ package.json manquant"
}

if (Test-Path "node_modules") {
    Write-Log "✅ node_modules présent"
} else {
    Write-Log "❌ node_modules manquant - Exécutez 'npm install'"
}

Write-Log ""
Write-Log "--- Démarrage en mode debug verbeux ---"
$env:EXPO_DEBUG = "true"
$env:DEBUG = "*"
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "localhost"

Write-Host ""
Write-Host "Démarrage du serveur avec logs détaillés..." -ForegroundColor Cyan
npx expo start --clear 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Log ""
Write-Log "=== FIN DE LA SESSION DE DEBUG ==="
Write-Host ""
Write-Host "Logs sauvegardés dans: $logFile" -ForegroundColor Green

