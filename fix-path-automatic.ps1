# fix-path-automatic.ps1
# Correction automatique du PATH système pour Cursor

Write-Host "🔧 Correction automatique du PATH système Cursor" -ForegroundColor Green

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️ Privilèges administrateur requis pour modifier le PATH système" -ForegroundColor Yellow
    Write-Host "🔄 Redémarrage avec privilèges administrateur..." -ForegroundColor Cyan
    
    # Redémarrer avec privilèges administrateur
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process PowerShell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`""
    exit
}

Write-Host "✅ Privilèges administrateur confirmés" -ForegroundColor Green

# Obtenir le chemin actuel de Cursor
try {
    $cursorPath = (Get-Command cursor).Source
    $cursorBinDir = Split-Path $cursorPath -Parent
    Write-Host "📍 Répertoire Cursor CLI: $cursorBinDir" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Cursor CLI non trouvé. Ajout manuel du chemin..." -ForegroundColor Red
    $cursorBinDir = "C:\Program Files\Cursor\resources\app\bin"
}

# Obtenir le PATH système actuel
$currentSystemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
Write-Host "📋 PATH système actuel: $($currentSystemPath.Length) caractères" -ForegroundColor Yellow

# Vérifier si le chemin Cursor est déjà dans le PATH
if ($currentSystemPath -like "*$cursorBinDir*") {
    Write-Host "✅ Le chemin Cursor est déjà dans le PATH système" -ForegroundColor Green
} else {
    Write-Host "⚠️ Ajout du chemin Cursor au PATH système..." -ForegroundColor Yellow
    
    # Ajouter le chemin Cursor au PATH système
    $newSystemPath = "$currentSystemPath;$cursorBinDir"
    [Environment]::SetEnvironmentVariable("Path", $newSystemPath, "Machine")
    
    Write-Host "✅ Chemin Cursor ajouté au PATH système" -ForegroundColor Green
}

# Nettoyer les anciens chemins Cursor (optionnel)
Write-Host "🧹 Nettoyage des anciens chemins Cursor..." -ForegroundColor Yellow

$oldCursorPaths = @(
    "*\AppData\Local\Programs\cursor\*",
    "*\Program Files (x86)\Cursor\*"
)

$cleanedPath = $currentSystemPath
foreach ($oldPath in $oldCursorPaths) {
    $pathParts = $cleanedPath -split ';'
    $filteredParts = $pathParts | Where-Object { $_ -notlike $oldPath }
    $cleanedPath = $filteredParts -join ';'
}

if ($cleanedPath -ne $currentSystemPath) {
    [Environment]::SetEnvironmentVariable("Path", $cleanedPath, "Machine")
    Write-Host "✅ Anciens chemins Cursor nettoyés" -ForegroundColor Green
}

# Mettre à jour le PATH de la session actuelle
$env:PATH = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Vérification finale
Write-Host "`n🔍 Vérification finale..." -ForegroundColor Yellow
try {
    $version = cursor --version
    Write-Host "✅ Cursor CLI fonctionne: $version" -ForegroundColor Green
    Write-Host "✅ PATH système corrigé définitivement !" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Cursor CLI nécessite un redémarrage du terminal" -ForegroundColor Yellow
}

Write-Host "`n📋 Instructions finales:" -ForegroundColor Cyan
Write-Host "1. Fermez tous les terminaux/PowerShell ouverts" -ForegroundColor White
Write-Host "2. Ouvrez un nouveau terminal/PowerShell" -ForegroundColor White
Write-Host "3. Testez: cursor --version" -ForegroundColor White
Write-Host "4. Le PATH sera corrigé dans tous les nouveaux terminaux !" -ForegroundColor White

Write-Host "`n🎉 Correction automatique terminée !" -ForegroundColor Green

