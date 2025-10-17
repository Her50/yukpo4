# Verification simple de l'application

Write-Host ""
Write-Host "VERIFICATION APPLICATION" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Check 1: Repertoire
Write-Host "1. Repertoire:" -ForegroundColor Yellow
Write-Host "   $(Get-Location)" -ForegroundColor Gray

# Check 2: Metro
Write-Host ""
Write-Host "2. Metro:" -ForegroundColor Yellow
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProc) {
    Write-Host "   [OK] Metro actif - $($metroProc.Count) processus" -ForegroundColor Green
} else {
    Write-Host "   [X] Metro arrete" -ForegroundColor Red
}

# Check 3: Modules
Write-Host ""
Write-Host "3. Modules critiques:" -ForegroundColor Yellow
if (Test-Path "node_modules/react-native-web") {
    Write-Host "   [OK] react-native-web" -ForegroundColor Green
} else {
    Write-Host "   [X] react-native-web manquant" -ForegroundColor Red
}

if (Test-Path "node_modules/expo") {
    Write-Host "   [OK] expo" -ForegroundColor Green
} else {
    Write-Host "   [X] expo manquant" -ForegroundColor Red
}

# Check 4: Fichiers
Write-Host ""
Write-Host "4. Fichiers critiques:" -ForegroundColor Yellow
if (Test-Path "App.tsx") {
    Write-Host "   [OK] App.tsx" -ForegroundColor Green
} else {
    Write-Host "   [X] App.tsx manquant" -ForegroundColor Red
}

if (Test-Path "src/utils/jwtDecode.ts") {
    Write-Host "   [OK] jwtDecode.ts" -ForegroundColor Green
} else {
    Write-Host "   [X] jwtDecode.ts manquant" -ForegroundColor Red
}

# Resume
Write-Host ""
Write-Host "========================" -ForegroundColor Cyan
Write-Host "RESUME" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

if ($metroProc) {
    Write-Host ""
    Write-Host "[OK] Application prete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour tester:" -ForegroundColor Cyan
    Write-Host "1. Ouvrez http://localhost:8081" -ForegroundColor White
    Write-Host "2. Scannez le QR code" -ForegroundColor White
    Write-Host "3. L'app devrait se charger" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "[X] Metro non actif" -ForegroundColor Red
    Write-Host "   Lancez: npm start" -ForegroundColor Yellow
}

Write-Host ""
