#!/usr/bin/env pwsh
# Script pour analyser le gap entre Git et le cache local SQLx

Write-Host "=== Analyse du Gap SQLx ===" -ForegroundColor Green

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Definition)

# 1. Compter les fichiers dans Git
Write-Host "1. Comptage des fichiers dans Git..." -ForegroundColor Cyan
$gitFilesList = git ls-files backend/.sqlx 2>$null
$gitCount = ($gitFilesList | Measure-Object).Count
Write-Host "   Fichiers dans Git: $gitCount" -ForegroundColor Yellow

# 2. Compter les fichiers locaux
Write-Host "2. Comptage des fichiers locaux..." -ForegroundColor Cyan
$localFilesList = Get-ChildItem -Path .sqlx -File -Recurse -ErrorAction SilentlyContinue
$localCount = ($localFilesList | Measure-Object).Count
Write-Host "   Fichiers locaux: $localCount" -ForegroundColor Yellow

# 3. Calculer le gap
$gap = $gitCount - $localCount
Write-Host "3. Gap: $gap fichiers" -ForegroundColor $(if ($gap -ne 0) { "Red" } else { "Green" })

# 4. Normaliser les noms pour comparaison
Write-Host "4. Comparaison des fichiers..." -ForegroundColor Cyan
$gitNormalized = $gitFilesList | ForEach-Object { 
    $_ -replace "^backend/\.sqlx/", ""
}
$localNormalized = $localFilesList | ForEach-Object {
    $_.FullName -replace [regex]::Escape((Resolve-Path .sqlx).Path + "\"), "" -replace "\\", "/"
}

# 5. Fichiers dans Git mais pas localement
$inGitNotLocal = $gitNormalized | Where-Object { $localNormalized -notcontains $_ }
Write-Host "   Fichiers dans Git mais pas localement: $($inGitNotLocal.Count)" -ForegroundColor Yellow

# 6. Fichiers locaux mais pas dans Git
$inLocalNotGit = $localNormalized | Where-Object { $gitNormalized -notcontains $_ }
Write-Host "   Fichiers locaux mais pas dans Git: $($inLocalNotGit.Count)" -ForegroundColor Yellow

# 7. Afficher les premiers fichiers manquants
if ($inGitNotLocal.Count -gt 0) {
    Write-Host ""
    Write-Host "Premiers fichiers dans Git mais pas localement:" -ForegroundColor Red
    $inGitNotLocal | Select-Object -First 10 | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
}

if ($inLocalNotGit.Count -gt 0) {
    Write-Host ""
    Write-Host "Premiers fichiers locaux mais pas dans Git:" -ForegroundColor Red
    $inLocalNotGit | Select-Object -First 10 | ForEach-Object { Write-Host "   + $_" -ForegroundColor Yellow }
}

# 8. Analyser pourquoi ces fichiers ne sont pas pris en compte
Write-Host ""
Write-Host "5. Analyse des fichiers manquants..." -ForegroundColor Cyan
if ($inGitNotLocal.Count -gt 0) {
    Write-Host "   Les fichiers dans Git mais pas localement ne seront PAS copiés dans Docker" -ForegroundColor Red
    Write-Host "   Car Docker copie depuis le contexte Git, pas depuis le système de fichiers local" -ForegroundColor Yellow
}

if ($inLocalNotGit.Count -gt 0) {
    Write-Host "   Les fichiers locaux mais pas dans Git ne seront PAS copiés dans Docker" -ForegroundColor Red
    Write-Host "   Car Docker copie depuis Git, donc ces fichiers doivent être committés" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Fin de l'analyse ===" -ForegroundColor Green

