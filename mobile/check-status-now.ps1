# Verification immediate de l'etat de l'application

Write-Host ""
Write-Host "VERIFICATION IMMEDIATE" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

# Check 1: Repertoire
Write-Host "1. Repertoire actuel:" -ForegroundColor Yellow
Write-Host "   $(Get-Location)" -ForegroundColor Gray

# Check 2: Metro
Write-Host ""
Write-Host "2. Metro Bundler:" -ForegroundColor Yellow
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProc) {
    Write-Host "   [OK] Metro ACTIF - $($metroProc.Count) processus" -ForegroundColor Green
    $memUsage = [math]::Round($metroProc[0].WorkingSet64 / 1MB, 0)
    Write-Host "   Memoire: ${memUsage} MB" -ForegroundColor Cyan
}
else {
    Write-Host "   [X] Metro ARRETE" -ForegroundColor Red
}

# Check 3: Port 8081
Write-Host ""
Write-Host "3. Serveur Metro:" -ForegroundColor Yellow
try {
    $connection = Test-NetConnection -ComputerName localhost -Port 8081 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "   [OK] Port 8081 accessible" -ForegroundColor Green
        Write-Host "   URL: http://localhost:8081" -ForegroundColor Cyan
    }
    else {
        Write-Host "   [X] Port 8081 non accessible" -ForegroundColor Red
    }
}
catch {
    Write-Host "   [?] Port 8081 non verifiable" -ForegroundColor Yellow
}

# Check 4: Fichiers critiques
Write-Host ""
Write-Host "4. Fichiers critiques:" -ForegroundColor Yellow
if (Test-Path "App.tsx") {
    Write-Host "   [OK] App.tsx" -ForegroundColor Green
}
else {
    Write-Host "   [X] App.tsx MANQUANT" -ForegroundColor Red
}

if (Test-Path "src/utils/jwtDecode.ts") {
    Write-Host "   [OK] jwtDecode.ts" -ForegroundColor Green
}
else {
    Write-Host "   [X] jwtDecode.ts MANQUANT" -ForegroundColor Red
}

# Check 5: Modules
Write-Host ""
Write-Host "5. Modules critiques:" -ForegroundColor Yellow
if (Test-Path "node_modules/react-native-web") {
    Write-Host "   [OK] react-native-web" -ForegroundColor Green
}
else {
    Write-Host "   [X] react-native-web MANQUANT" -ForegroundColor Red
}

# Resume
Write-Host ""
Write-Host "=====================" -ForegroundColor Cyan
Write-Host "RESUME" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

if ($metroProc) {
    Write-Host ""
    Write-Host "[SUCCES] Application ACTIVE!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Actions immediates:" -ForegroundColor Cyan
    Write-Host "1. Ouvrez http://localhost:8081 dans votre navigateur" -ForegroundColor White
    Write-Host "2. Scannez le QR code avec Expo Go" -ForegroundColor White
    Write-Host "3. L'analyse des logs surveille automatiquement" -ForegroundColor White
    Write-Host ""
    Write-Host "L'application est prete pour les tests!" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "[ACTION REQUISE] Metro non actif" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pour lancer Metro:" -ForegroundColor Yellow
    Write-Host "  npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "OU relancer avec cache propre:" -ForegroundColor Yellow
    Write-Host "  npm start -- --clear" -ForegroundColor White
}

Write-Host ""
