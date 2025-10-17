# Test de demarrage Metro avec capture des logs

$logFile = "test-metro-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  TEST DEMARRAGE METRO" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Verification pre-lancement..." -ForegroundColor Yellow

if (Test-Path "App.tsx") {
    Write-Host "  [OK] App.tsx present" -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] App.tsx manquant!" -ForegroundColor Red
    exit 1
}

if (Test-Path "node_modules") {
    Write-Host "  [OK] node_modules present" -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] node_modules manquant!" -ForegroundColor Red
    Write-Host "  --> Lancez: npm install" -ForegroundColor Yellow
    exit 1
}

if (Test-Path "package.json") {
    Write-Host "  [OK] package.json present" -ForegroundColor Green
} else {
    Write-Host "  [ERREUR] package.json manquant!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/4] Nettoyage cache Metro..." -ForegroundColor Yellow
if (Test-Path ".expo") {
    Remove-Item ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Cache .expo supprime" -ForegroundColor Green
}

if (Test-Path "node_modules/.cache") {
    Remove-Item "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Cache node_modules supprime" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/4] Restauration App.tsx..." -ForegroundColor Yellow
if (Test-Path "App.tsx.backup") {
    Copy-Item "App.tsx.backup" "App.tsx" -Force
    Write-Host "  [OK] App.tsx restaure" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Pas de backup" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[4/4] Demarrage Metro (avec logs)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Metro va demarrer maintenant" -ForegroundColor Green
Write-Host "  Logs sauvegardes dans: $logFile" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Attendez le QR code (10-30 secondes)..." -ForegroundColor Yellow
Write-Host "Pour arreter: Ctrl+C" -ForegroundColor Gray
Write-Host ""

# Lancer npm start et capturer les logs
$process = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru -NoNewWindow -RedirectStandardOutput $logFile -RedirectStandardError "${logFile}.err"

Write-Host "[INFO] Processus npm lance (PID: $($process.Id))" -ForegroundColor Cyan
Write-Host "[INFO] Surveillance pendant 60 secondes..." -ForegroundColor Cyan
Write-Host ""

# Surveiller pendant 60 secondes
for ($i = 1; $i -le 60; $i++) {
    Start-Sleep -Seconds 1
    
    # Verifier si Metro (node) est lance
    $nodeProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($nodeProc -and $i -eq 10) {
        Write-Host "[OK] Metro detecte apres 10 secondes!" -ForegroundColor Green
        Write-Host "     PID: $($nodeProc[0].Id)" -ForegroundColor Cyan
        Write-Host "     Memoire: $([math]::Round($nodeProc[0].WorkingSet64/1MB, 0)) MB" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Verifiez un NOUVEAU TERMINAL qui a du s'ouvrir avec le QR code!" -ForegroundColor Yellow
        Write-Host ""
    }
    
    # Afficher un point tous les 5 secondes
    if ($i % 5 -eq 0) {
        Write-Host "  [$i/60s] Toujours en attente..." -ForegroundColor Gray
        
        # Lire les logs
        if (Test-Path $logFile) {
            $content = Get-Content $logFile -Tail 3 -ErrorAction SilentlyContinue
            if ($content) {
                Write-Host "  Derniers logs:" -ForegroundColor Cyan
                $content | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
            }
        }
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE DES LOGS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $logFile) {
    $logs = Get-Content $logFile -ErrorAction SilentlyContinue
    
    if ($logs) {
        Write-Host "Logs captures ($($logs.Count) lignes):" -ForegroundColor Cyan
        Write-Host ""
        
        # Chercher les erreurs
        $errors = $logs | Select-String -Pattern "Error|ERROR|Failed|Cannot" -CaseSensitive:$false
        if ($errors) {
            Write-Host "[ERREURS DETECTEES]" -ForegroundColor Red
            $errors | Select-Object -First 5 | ForEach-Object {
                Write-Host "  - $($_.Line)" -ForegroundColor Red
            }
            Write-Host ""
        }
        
        # Chercher les succes
        $success = $logs | Select-String -Pattern "Metro|waiting|QR|exp://" -CaseSensitive:$false
        if ($success) {
            Write-Host "[SUCCES DETECTES]" -ForegroundColor Green
            $success | Select-Object -First 5 | ForEach-Object {
                Write-Host "  - $($_.Line)" -ForegroundColor Green
            }
            Write-Host ""
        }
        
        Write-Host "Log complet disponible dans: $logFile" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] Fichier de log vide" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERREUR] Pas de fichier de log genere" -ForegroundColor Red
}

# Verifier les erreurs stderr
if (Test-Path "${logFile}.err") {
    $errContent = Get-Content "${logFile}.err" -ErrorAction SilentlyContinue
    if ($errContent) {
        Write-Host ""
        Write-Host "[ERREURS STDERR]" -ForegroundColor Red
        $errContent | Select-Object -First 10 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$nodeProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProc) {
    Write-Host "[SUCCES] Metro semble actif!" -ForegroundColor Green
    Write-Host "  Verifiez le terminal Metro pour le QR code" -ForegroundColor Yellow
} else {
    Write-Host "[ERREUR] Metro n'est pas actif" -ForegroundColor Red
    Write-Host "  Consultez les logs ci-dessus pour plus d'infos" -ForegroundColor Yellow
}

Write-Host ""

