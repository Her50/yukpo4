# Script pour capturer les erreurs Expo en temps reel

$errorLog = "expo-errors-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"

Write-Host "`n========================================" -ForegroundColor Red
Write-Host "  CAPTURE ERREURS EXPO" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

Write-Host "[1/5] Verification Metro..." -ForegroundColor Cyan
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProc) {
    Write-Host "  [OK] Metro actif (PID: $($metroProc[0].Id))" -ForegroundColor Green
}
else {
    Write-Host "  [ERREUR] Metro non actif!" -ForegroundColor Red
    Write-Host "  --> Lancez: npm start" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[2/5] Verification App.tsx..." -ForegroundColor Cyan
if (Test-Path "App.tsx") {
    $appContent = Get-Content "App.tsx" -Raw
    if ($appContent -match "NavigationContainer") {
        Write-Host "  [OK] NavigationContainer present" -ForegroundColor Green
    }
    else {
        Write-Host "  [ERREUR] NavigationContainer MANQUANT!" -ForegroundColor Red
    }
    
    if ($appContent -match "ErrorBoundary") {
        Write-Host "  [OK] ErrorBoundary present" -ForegroundColor Green
    }
    else {
        Write-Host "  [WARN] ErrorBoundary manquant" -ForegroundColor Yellow
    }
    
    if ($appContent -match "AuthProvider") {
        Write-Host "  [OK] AuthProvider present" -ForegroundColor Green
    }
    else {
        Write-Host "  [ERREUR] AuthProvider MANQUANT!" -ForegroundColor Red
    }
}
else {
    Write-Host "  [ERREUR] App.tsx MANQUANT!" -ForegroundColor Red
}

Write-Host ""
Write-Host "[3/5] Verification dependances critiques..." -ForegroundColor Cyan
$criticalFiles = @(
    "src/navigation/AppNavigator.tsx",
    "src/contexts/AuthContext.tsx",
    "src/components/ErrorBoundary.tsx",
    "src/theme/theme.ts"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    }
    else {
        Write-Host "  [ERREUR] $file MANQUANT!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[4/5] Restauration App.tsx depuis backup..." -ForegroundColor Cyan
if (Test-Path "App.tsx.backup") {
    Copy-Item "App.tsx.backup" "App.tsx" -Force
    Write-Host "  [OK] App.tsx restaure" -ForegroundColor Green
}
else {
    Write-Host "  [WARN] Pas de backup disponible" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/5] Lancement Metro avec capture d'erreurs..." -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  INSTRUCTIONS POUR DEBUG" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Metro va redemarrer avec logs detailles" -ForegroundColor White
Write-Host "2. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "3. Quand l'app crash, les erreurs s'afficheront ici" -ForegroundColor White
Write-Host "4. Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""
Write-Host "Logs sauvegardes dans: $errorLog" -ForegroundColor Cyan
Write-Host ""

# Arreter Metro actuel
Write-Host "Arret Metro actuel..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host "Demarrage Metro avec logs..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Lancer Metro avec capture des erreurs
try {
    npm start 2>&1 | Tee-Object -FilePath $errorLog
}
catch {
    Write-Host "`nErreur lors du lancement: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Red
Write-Host "  ANALYSE DES ERREURS" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red

if (Test-Path $errorLog) {
    $logs = Get-Content $errorLog -ErrorAction SilentlyContinue
    
    if ($logs) {
        Write-Host "`nLogs captures ($($logs.Count) lignes):" -ForegroundColor Cyan
        
        # Analyser les erreurs
        $errors = $logs | Select-String -Pattern "Error|ERROR|Failed|Cannot|undefined|TypeError|ReferenceError" -CaseSensitive:$false
        
        if ($errors) {
            Write-Host "`n[ERREURS DETECTEES]" -ForegroundColor Red
            $errors | ForEach-Object {
                Write-Host "  - $($_.Line)" -ForegroundColor Red
            }
        }
        else {
            Write-Host "`n[AUCUNE ERREUR DETECTEE DANS LES LOGS]" -ForegroundColor Green
        }
        
        # Analyser les warnings
        $warnings = $logs | Select-String -Pattern "Warning|WARN|Deprecated" -CaseSensitive:$false
        if ($warnings) {
            Write-Host "`n[WARNINGS DETECTES]" -ForegroundColor Yellow
            $warnings | ForEach-Object {
                Write-Host "  - $($_.Line)" -ForegroundColor Yellow
            }
        }
        
        Write-Host "`nLog complet: $errorLog" -ForegroundColor Cyan
    }
}

Write-Host ""

