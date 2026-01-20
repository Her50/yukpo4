# Script pour preparer Blender pour Docker
# Trouve le fichier Blender dans Downloads et le copie dans backend/blender/

$ErrorActionPreference = "Stop"

Write-Host "Preparation de Blender pour Docker..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Chemins
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$downloadsPath = "$env:USERPROFILE\Downloads"
$blenderDir = Join-Path $projectRoot "backend\blender"
$targetFile = Join-Path $blenderDir "blender-4.0.0-linux-x64.tar"

# Chercher le fichier Blender dans Downloads
Write-Host "[*] Recherche de Blender dans $downloadsPath..." -ForegroundColor Yellow

$blenderFiles = Get-ChildItem -Path $downloadsPath -Filter "*blender*" -ErrorAction SilentlyContinue | 
    Where-Object { $_.Name -like "*linux*" -and ($_.Extension -eq ".tar" -or $_.Extension -eq ".xz" -or $_.Name -like "*.tar.xz") }

if ($null -eq $blenderFiles -or $blenderFiles.Count -eq 0) {
    Write-Host "[ERREUR] Aucun fichier Blender Linux trouve dans Downloads" -ForegroundColor Red
    Write-Host ""
    Write-Host "Assurez-vous que le fichier blender-4.0.0-linux-x64.tar est dans:" -ForegroundColor Yellow
    Write-Host "  $downloadsPath" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Prendre le premier fichier trouve
$sourceFile = $blenderFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host "[OK] Fichier trouve: $($sourceFile.Name)" -ForegroundColor Green
Write-Host "     Chemin: $($sourceFile.FullName)" -ForegroundColor Gray
Write-Host "     Taille: $([math]::Round($sourceFile.Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Creer le dossier blender s'il n'existe pas
if (-not (Test-Path $blenderDir)) {
    New-Item -ItemType Directory -Path $blenderDir -Force | Out-Null
    Write-Host "[OK] Dossier cree: $blenderDir" -ForegroundColor Green
}

# Determiner le nom du fichier de destination
# Si le fichier source est .tar.xz, on garde cette extension
# Sinon, on copie avec .tar
if ($sourceFile.Name -like "*.tar.xz") {
    $targetFile = Join-Path $blenderDir "blender-4.0.0-linux-x64.tar.xz"
} else {
    $targetFile = Join-Path $blenderDir "blender-4.0.0-linux-x64.tar"
}

# Copier le fichier
Write-Host "[*] Copie du fichier vers $targetFile..." -ForegroundColor Yellow

try {
    Copy-Item -Path $sourceFile.FullName -Destination $targetFile -Force
    $copiedFile = Get-Item $targetFile
    
    Write-Host "[OK] Blender copie avec succes!" -ForegroundColor Green
    Write-Host "     Destination: $targetFile" -ForegroundColor Gray
    Write-Host "     Taille: $([math]::Round($copiedFile.Length / 1MB, 2)) MB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Vous pouvez maintenant builder l'image Docker:" -ForegroundColor Cyan
    Write-Host "  .\scripts\build-backend-docker.ps1" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "[ERREUR] Echec de la copie: $_" -ForegroundColor Red
    exit 1
}






