# Script pour forcer la regeneration complete des icones
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  REGENERATION COMPLETE DES ICONES" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Etape 1: Verifier que les fichiers PNG existent
Write-Host "Etape 1: Verification des fichiers PNG..." -ForegroundColor Cyan
if (Test-Path "assets\icon.png") {
    $icon = Get-Item "assets\icon.png"
    Write-Host "  OK icon.png existe (taille: $($icon.Length) bytes, modifie: $($icon.LastWriteTime))" -ForegroundColor Green
} else {
    Write-Host "  ERREUR: icon.png n'existe pas!" -ForegroundColor Red
    exit 1
}

if (Test-Path "assets\adaptive-icon.png") {
    $adaptive = Get-Item "assets\adaptive-icon.png"
    Write-Host "  OK adaptive-icon.png existe (taille: $($adaptive.Length) bytes, modifie: $($adaptive.LastWriteTime))" -ForegroundColor Green
} else {
    Write-Host "  ERREUR: adaptive-icon.png n'existe pas!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Etape 2: Supprimer les dossiers natifs pour forcer la regeneration
Write-Host "Etape 2: Nettoyage des dossiers natifs..." -ForegroundColor Cyan
if (Test-Path "android") {
    Write-Host "  Suppression du dossier android..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "android" -ErrorAction SilentlyContinue
    Write-Host "  OK Dossier android supprime" -ForegroundColor Green
} else {
    Write-Host "  OK Dossier android n'existe pas (normal)" -ForegroundColor Green
}

if (Test-Path "ios") {
    Write-Host "  Suppression du dossier ios..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "ios" -ErrorAction SilentlyContinue
    Write-Host "  OK Dossier ios supprime" -ForegroundColor Green
} else {
    Write-Host "  OK Dossier ios n'existe pas (normal)" -ForegroundColor Green
}
Write-Host ""

# Etape 3: Nettoyer le cache
Write-Host "Etape 3: Nettoyage du cache..." -ForegroundColor Cyan
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
    Write-Host "  OK Cache .expo supprime" -ForegroundColor Green
}
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "  OK Cache node_modules supprime" -ForegroundColor Green
}
Write-Host ""

# Etape 4: Prebuild pour regenerer les icones
Write-Host "Etape 4: Prebuild pour regenerer les icones Android/iOS..." -ForegroundColor Cyan
Write-Host "  Execution: npx expo prebuild --clean" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANT: Cette commande va regenerer les dossiers android et ios" -ForegroundColor Yellow
Write-Host "  avec les nouvelles icones (Y violet sur fond blanc)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Appuyez sur Entree pour continuer, ou Ctrl+C pour annuler..." -ForegroundColor Cyan
Read-Host

npx expo prebuild --clean

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  OK Prebuild termine avec succes!" -ForegroundColor Green
    Write-Host ""
    
    # Verifier que les icones Android ont ete generees
    if (Test-Path "android\app\src\main\res") {
        Write-Host "  Verification des icones Android generees..." -ForegroundColor Cyan
        $mipmapDirs = Get-ChildItem "android\app\src\main\res" -Directory | Where-Object { $_.Name -like "mipmap-*" }
        foreach ($dir in $mipmapDirs) {
            $iconeFile = Join-Path $dir.FullName "ic_launcher.png"
            if (Test-Path $iconeFile) {
                Write-Host "    OK $($dir.Name)\ic_launcher.png existe" -ForegroundColor Green
            } else {
                Write-Host "    ATTENTION: $($dir.Name)\ic_launcher.png n'existe pas" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host ""
    Write-Host "  ERREUR lors du prebuild!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  REGENERATION TERMINEE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "  1. Build Android: npx expo run:android" -ForegroundColor White
Write-Host "  2. OU Build iOS: npx expo run:ios" -ForegroundColor White
Write-Host "  3. Tester sur un appareil/emulateur" -ForegroundColor White
Write-Host "  4. Si l'icone ne change pas, desinstaller et reinstaller l'app" -ForegroundColor White
Write-Host ""

