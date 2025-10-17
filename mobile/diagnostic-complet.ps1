# Diagnostic complet de l'erreur "Something went wrong"

Write-Host "====================================" -ForegroundColor Red
Write-Host " DIAGNOSTIC ERREUR EXPO" -ForegroundColor Red
Write-Host "====================================" -ForegroundColor Red
Write-Host ""

Write-Host "[1/6] Verification des fichiers..." -ForegroundColor Yellow
Write-Host "App.tsx actuel:" -ForegroundColor Cyan
Get-Content App.tsx
Write-Host ""

Write-Host "[2/6] Verification des dependances critiques..." -ForegroundColor Yellow
$criticalDeps = @(
    "react",
    "react-native",
    "expo",
    "@react-navigation/native",
    "react-native-gesture-handler",
    "react-native-safe-area-context"
)

foreach ($dep in $criticalDeps) {
    $path = "node_modules\$dep\package.json"
    if (Test-Path $path) {
        Write-Host "  OK $dep" -ForegroundColor Green
    }
    else {
        Write-Host "  MANQUANT $dep" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[3/6] Verification des plugins Expo..." -ForegroundColor Yellow
$pluginsPath = "node_modules\expo\plugins"
if (Test-Path $pluginsPath) {
    Write-Host "  OK Plugins Expo trouves" -ForegroundColor Green
}
else {
    Write-Host "  ATTENTION: Plugins Expo manquants" -ForegroundColor Red
}

Write-Host ""
Write-Host "[4/6] Verification du cache Metro..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Write-Host "  Cache Expo present" -ForegroundColor Yellow
}
if (Test-Path "node_modules\.cache") {
    Write-Host "  Cache Metro present" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/6] Verification de la configuration..." -ForegroundColor Yellow
Write-Host "app.json:" -ForegroundColor Cyan
Get-Content app.json | Select-Object -First 10

Write-Host ""
Write-Host "[6/6] Test avec version ultra-minimale..." -ForegroundColor Yellow
Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host " INSTRUCTIONS DE TEST" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "2. Si vous voyez 'Test OK' sur fond bleu → SUCCES" -ForegroundColor Green
Write-Host "3. Si vous voyez encore l'erreur → Probleme de dependances" -ForegroundColor Red
Write-Host ""
Write-Host "Serveur lance en mode production..." -ForegroundColor Cyan
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""

npx expo start --clear
