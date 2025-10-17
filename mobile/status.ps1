# Check application status - Simple version

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  STATUT DE L'APPLICATION" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$checksPassed = 0
$totalChecks = 5

# Check 1: App.tsx
Write-Host "[1/5] App.tsx:" -ForegroundColor Yellow
if (Test-Path "App.tsx") {
    Write-Host "  OK - Fichier present" -ForegroundColor Green
    $checksPassed++
} else {
    Write-Host "  ERREUR - Fichier manquant" -ForegroundColor Red
}

# Check 2: node_modules
Write-Host "[2/5] node_modules:" -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  OK - Dependances installees" -ForegroundColor Green
    $checksPassed++
} else {
    Write-Host "  ERREUR - Dependances manquantes" -ForegroundColor Red
    Write-Host "  --> Lancez: npm install" -ForegroundColor Yellow
}

# Check 3: package.json
Write-Host "[3/5] package.json:" -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "  OK - Configuration presente" -ForegroundColor Green
    $checksPassed++
} else {
    Write-Host "  ERREUR - Configuration manquante" -ForegroundColor Red
}

# Check 4: Metro process
Write-Host "[4/5] Processus Metro:" -ForegroundColor Yellow
$nodeProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProc) {
    Write-Host "  OK - Metro en cours d'execution (PID: $($nodeProc[0].Id))" -ForegroundColor Green
    $checksPassed++
} else {
    Write-Host "  INFO - Metro non demarre" -ForegroundColor Gray
    Write-Host "  --> Lancez: npm start" -ForegroundColor Yellow
}

# Check 5: src directory
Write-Host "[5/5] Dossier src:" -ForegroundColor Yellow
if (Test-Path "src") {
    $screenCount = (Get-ChildItem "src\screens" -ErrorAction SilentlyContinue).Count
    $componentCount = (Get-ChildItem "src\components" -ErrorAction SilentlyContinue).Count
    Write-Host "  OK - $screenCount screens, $componentCount components" -ForegroundColor Green
    $checksPassed++
} else {
    Write-Host "  ERREUR - Dossier src manquant" -ForegroundColor Red
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  RESUME" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verifications reussies: $checksPassed / $totalChecks" -ForegroundColor $(if ($checksPassed -eq $totalChecks) { "Green" } else { "Yellow" })
Write-Host ""

if ($checksPassed -ge 3) {
    Write-Host "L'application est prete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour lancer:" -ForegroundColor Cyan
    Write-Host "  powershell -File launch.ps1" -ForegroundColor White
} else {
    Write-Host "Corrigez les erreurs ci-dessus avant de lancer" -ForegroundColor Yellow
}

Write-Host ""

