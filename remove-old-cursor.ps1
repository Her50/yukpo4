# remove-old-cursor.ps1
# Suppression de l'ancienne installation Cursor

Write-Host "🗑️ Suppression de l'ancienne installation Cursor" -ForegroundColor Green

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "Privileges administrateur requis" -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process PowerShell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`""
    exit
}

Write-Host "Privileges administrateur confirmes" -ForegroundColor Green

# Chemin de l'ancienne installation
$oldCursorPath = "C:\Users\$env:USERNAME\AppData\Local\Programs\cursor"

# Vérifier si l'ancienne installation existe
if (Test-Path $oldCursorPath) {
    Write-Host "Ancienne installation trouvee: $oldCursorPath" -ForegroundColor Yellow
    Write-Host "Suppression en cours..." -ForegroundColor Yellow
    
    try {
        Remove-Item -Path $oldCursorPath -Recurse -Force
        Write-Host "Ancienne installation supprimee avec succes" -ForegroundColor Green
    } catch {
        Write-Host "Erreur lors de la suppression: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Tentative de suppression manuelle..." -ForegroundColor Yellow
        
        # Supprimer les fichiers un par un
        Get-ChildItem -Path $oldCursorPath -Recurse -Force | Remove-Item -Force
        Remove-Item -Path $oldCursorPath -Force
        Write-Host "Suppression manuelle terminee" -ForegroundColor Green
    }
} else {
    Write-Host "Ancienne installation non trouvee" -ForegroundColor Green
}

# Nettoyer le PATH système
Write-Host "Nettoyage du PATH systeme..." -ForegroundColor Yellow

$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$pathParts = $currentPath -split ';'
$cleanedParts = $pathParts | Where-Object { $_ -notlike "*AppData\Local\Programs\cursor*" }
$newPath = $cleanedParts -join ';'

if ($newPath -ne $currentPath) {
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    Write-Host "PATH systeme nettoye" -ForegroundColor Green
}

# Ajouter le nouveau chemin
$newCursorPath = "C:\Program Files\Cursor\resources\app\bin"
if ($newPath -notlike "*$newCursorPath*") {
    $finalPath = "$newPath;$newCursorPath"
    [Environment]::SetEnvironmentVariable("Path", $finalPath, "Machine")
    Write-Host "Nouveau chemin Cursor ajoute au PATH" -ForegroundColor Green
}

# Mettre à jour le PATH de la session
$env:PATH = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Vérification finale
Write-Host "Verification finale..." -ForegroundColor Yellow
try {
    $version = cursor --version
    Write-Host "Cursor CLI fonctionne: $version" -ForegroundColor Green
} catch {
    Write-Host "Redemarrage du terminal necessaire" -ForegroundColor Yellow
}

Write-Host "Suppression terminee !" -ForegroundColor Green

