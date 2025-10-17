# Launch Yukpomnang Mobile App
# Simple script sans erreurs

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  YUKPOMNANG MOBILE - LANCEMENT" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1: Restaurer App.tsx
Write-Host "[Etape 1/3] Restauration de App.tsx..." -ForegroundColor Yellow

if (Test-Path "App.tsx.backup") {
    Copy-Item "App.tsx.backup" "App.tsx" -Force
    Write-Host "  OK - App.tsx restaure avec succes" -ForegroundColor Green
} else {
    Write-Host "  INFO - App.tsx.backup non trouve" -ForegroundColor Gray
}

Write-Host ""

# Etape 2: Verification
Write-Host "[Etape 2/3] Verification..." -ForegroundColor Yellow

$allGood = $true

if (Test-Path "App.tsx") {
    Write-Host "  OK - App.tsx present" -ForegroundColor Green
} else {
    Write-Host "  ERREUR - App.tsx manquant" -ForegroundColor Red
    $allGood = $false
}

if (Test-Path "node_modules") {
    Write-Host "  OK - node_modules present" -ForegroundColor Green
} else {
    Write-Host "  ERREUR - node_modules manquant" -ForegroundColor Red
    Write-Host "  --> Lancez: npm install" -ForegroundColor Yellow
    $allGood = $false
}

if (Test-Path "package.json") {
    Write-Host "  OK - package.json present" -ForegroundColor Green
} else {
    Write-Host "  ERREUR - package.json manquant" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""

# Etape 3: Lancement
if ($allGood) {
    Write-Host "[Etape 3/3] Lancement de l'application..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "  INSTRUCTIONS" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "1. Attendez que Metro affiche le QR code" -ForegroundColor White
    Write-Host "2. Installez Expo Go sur votre telephone" -ForegroundColor White
    Write-Host "3. Scannez le QR code" -ForegroundColor White
    Write-Host "4. L'app se chargera automatiquement" -ForegroundColor White
    Write-Host ""
    Write-Host "Pour arreter: Ctrl+C" -ForegroundColor Yellow
    Write-Host "====================================" -ForegroundColor Green
    Write-Host ""
    
    npm start
} else {
    Write-Host "[Etape 3/3] ANNULE - Corrigez les erreurs ci-dessus" -ForegroundColor Red
    Write-Host ""
}

