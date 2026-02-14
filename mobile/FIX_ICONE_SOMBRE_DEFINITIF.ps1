# FIX DEFINITIF : Icone toujours sombre
# Ce script corrige TOUS les problemes identifies

Write-Host "FIX DEFINITIF : Correction de l'icone sombre" -ForegroundColor Cyan
Write-Host ""

# Etape 1 : Verifier les fichiers PNG
Write-Host "Etape 1 : Verification des fichiers PNG..." -ForegroundColor Yellow
$iconPath = "assets\icon.png"
$adaptiveIconPath = "assets\adaptive-icon.png"

if (-not (Test-Path $iconPath)) {
    Write-Host "ERREUR : $iconPath n'existe pas!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $adaptiveIconPath)) {
    Write-Host "ERREUR : $adaptiveIconPath n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "Fichiers PNG trouves" -ForegroundColor Green
Write-Host ""

# Etape 2 : Corriger la couleur iconBackground dans colors.xml
Write-Host "Etape 2 : Correction de la couleur iconBackground..." -ForegroundColor Yellow
$colorsXmlPath = "android\app\src\main\res\values\colors.xml"

if (Test-Path $colorsXmlPath) {
    $colorsContent = Get-Content $colorsXmlPath -Raw
    # Remplacer #0F172A par #FFFFFF pour iconBackground et splashscreen_background
    $colorsContent = $colorsContent -replace '<color name="splashscreen_background">#0F172A</color>', '<color name="splashscreen_background">#FFFFFF</color>'
    $colorsContent = $colorsContent -replace '<color name="iconBackground">#0F172A</color>', '<color name="iconBackground">#FFFFFF</color>'
    Set-Content -Path $colorsXmlPath -Value $colorsContent -NoNewline
    Write-Host "colors.xml corrige (iconBackground = #FFFFFF)" -ForegroundColor Green
} else {
    Write-Host "$colorsXmlPath n'existe pas (sera cree lors du prebuild)" -ForegroundColor Yellow
}
Write-Host ""

# Etape 3 : Nettoyer TOUT
Write-Host "Etape 3 : Nettoyage complet..." -ForegroundColor Yellow

# Supprimer le cache Expo
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
    Write-Host "Cache .expo supprime" -ForegroundColor Green
}

# Supprimer node_modules/.cache
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "Cache node_modules supprime" -ForegroundColor Green
}

Write-Host ""

# Etape 4 : Rebuild complet avec prebuild
Write-Host "Etape 4 : Rebuild complet avec prebuild..." -ForegroundColor Yellow
Write-Host "Cette etape va regenerer tous les fichiers Android/iOS" -ForegroundColor Yellow
Write-Host ""

# Verifier que app.config.js a la bonne configuration
Write-Host "Verification de app.config.js..." -ForegroundColor Yellow
$appConfigPath = "app.config.js"
if (Test-Path $appConfigPath) {
    $appConfigContent = Get-Content $appConfigPath -Raw
    if ($appConfigContent -match 'backgroundColor.*#FFFFFF') {
        Write-Host "app.config.js a backgroundColor = #FFFFFF" -ForegroundColor Green
    } else {
        Write-Host "Verifiez que backgroundColor = #FFFFFF dans app.config.js" -ForegroundColor Yellow
    }
} else {
    Write-Host "app.config.js n'existe pas" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Execution de npx expo prebuild --clean..." -ForegroundColor Cyan
Write-Host "(Cela va regenerer les fichiers Android/iOS avec les bonnes couleurs)" -ForegroundColor Gray
Write-Host ""

# Executer prebuild
npx expo prebuild --clean

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Prebuild termine avec succes!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Erreur lors du prebuild" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 5 : Verifier que les fichiers ont ete corriges
Write-Host "Etape 5 : Verification finale..." -ForegroundColor Yellow

if (Test-Path "android\app\src\main\res\values\colors.xml") {
    $colorsContent = Get-Content "android\app\src\main\res\values\colors.xml" -Raw
    if ($colorsContent -match 'iconBackground.*#FFFFFF') {
        Write-Host "colors.xml a iconBackground = #FFFFFF" -ForegroundColor Green
    } else {
        Write-Host "colors.xml n'a pas ete corrige automatiquement" -ForegroundColor Yellow
        Write-Host "Correction manuelle necessaire" -ForegroundColor Yellow
    }
} else {
    Write-Host "colors.xml n'existe pas encore" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "FIX TERMINE!" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Desinstallez completement l'application de l'appareil/emulateur" -ForegroundColor White
Write-Host "   2. Redemarrez l'appareil/emulateur (optionnel mais recommande)" -ForegroundColor White
Write-Host "   3. Rebuild et reinstallez:" -ForegroundColor White
Write-Host "      npx expo run:android" -ForegroundColor Gray
Write-Host ""
Write-Host "Si l'icone est toujours sombre apres ces etapes:" -ForegroundColor Yellow
Write-Host "   - Verifiez que les fichiers PNG dans assets/ sont clairs (fond blanc)" -ForegroundColor White
Write-Host "   - Verifiez que app.config.js a backgroundColor = #FFFFFF" -ForegroundColor White
Write-Host "   - Verifiez android/app/src/main/res/values/colors.xml" -ForegroundColor White
Write-Host ""
