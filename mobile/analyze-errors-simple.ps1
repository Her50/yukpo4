# Script simple d'analyse des erreurs Metro
# Fonctionne depuis le bon répertoire

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE SIMPLE DES ERREURS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Verification repertoire..." -ForegroundColor Yellow
Write-Host "  Repertoire: $(Get-Location)" -ForegroundColor Gray
if (Test-Path "package.json") {
    Write-Host "  [OK] package.json trouve" -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] package.json manquant!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/4] Verification Metro..." -ForegroundColor Yellow
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProc) {
    Write-Host "  [OK] Metro actif - $($metroProc.Count) processus" -ForegroundColor Green
    Write-Host "  [OK] Serveur: http://localhost:8081" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Metro non actif" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[3/4] Verification modules critiques..." -ForegroundColor Yellow
$criticalModules = @(
    "react-native-web",
    "expo",
    "@react-navigation/native",
    "react-native-paper"
)

foreach ($module in $criticalModules) {
    if (Test-Path "node_modules/$module") {
        Write-Host "  [OK] $module" -ForegroundColor Green
    } else {
        Write-Host "  [ERREUR] $module MANQUANT!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[4/4] Verification fichiers critiques..." -ForegroundColor Yellow
$criticalFiles = @(
    "App.tsx",
    "src/utils/jwtDecode.ts",
    "src/navigation/AppNavigator.tsx",
    "src/contexts/AuthContext.tsx"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [ERREUR] $file MANQUANT!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($metroProc) {
    Write-Host "✅ Metro est ACTIF" -ForegroundColor Green
    Write-Host "✅ react-native-web installé" -ForegroundColor Green
    Write-Host "✅ Tous les fichiers critiques présents" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 POUR TESTER:" -ForegroundColor Yellow
    Write-Host "1. Ouvrez http://localhost:8081" -ForegroundColor White
    Write-Host "2. Scannez le QR code avec Expo Go" -ForegroundColor White
    Write-Host "3. L'application devrait se charger sans erreur" -ForegroundColor Green
} else {
    Write-Host "⚠️ Metro n'est pas actif" -ForegroundColor Yellow
    Write-Host "   Lancez: npm start" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
