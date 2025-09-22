# fix-path-simple.ps1
# Correction simple du PATH système

Write-Host "Correction automatique du PATH Cursor" -ForegroundColor Green

# Vérifier les privilèges administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "Privileges administrateur requis" -ForegroundColor Yellow
    Write-Host "Redemarrage avec privileges administrateur..." -ForegroundColor Cyan
    
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process PowerShell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`""
    exit
}

Write-Host "Privileges administrateur confirmes" -ForegroundColor Green

# Obtenir le chemin Cursor
try {
    $cursorPath = (Get-Command cursor).Source
    $cursorBinDir = Split-Path $cursorPath -Parent
    Write-Host "Repertoire Cursor: $cursorBinDir" -ForegroundColor Cyan
} catch {
    $cursorBinDir = "C:\Program Files\Cursor\resources\app\bin"
    Write-Host "Chemin par defaut: $cursorBinDir" -ForegroundColor Yellow
}

# Obtenir le PATH système
$currentSystemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Vérifier si déjà présent
if ($currentSystemPath -like "*$cursorBinDir*") {
    Write-Host "Chemin Cursor deja dans le PATH" -ForegroundColor Green
} else {
    Write-Host "Ajout du chemin Cursor au PATH..." -ForegroundColor Yellow
    $newSystemPath = "$currentSystemPath;$cursorBinDir"
    [Environment]::SetEnvironmentVariable("Path", $newSystemPath, "Machine")
    Write-Host "Chemin ajoute au PATH systeme" -ForegroundColor Green
}

# Mettre à jour le PATH de la session
$env:PATH = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Vérification
try {
    $version = cursor --version
    Write-Host "Cursor CLI fonctionne: $version" -ForegroundColor Green
    Write-Host "PATH corrige definitivement !" -ForegroundColor Green
} catch {
    Write-Host "Redemarrage du terminal necessaire" -ForegroundColor Yellow
}

Write-Host "Correction terminee !" -ForegroundColor Green

