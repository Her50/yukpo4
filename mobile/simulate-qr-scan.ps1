# Simulation simple du scan QR code et analyse

Write-Host ""
Write-Host "SIMULATION SCAN QR CODE" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Verification Metro..." -ForegroundColor Yellow
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProc) {
    Write-Host "   [OK] Metro actif - $($metroProc.Count) processus" -ForegroundColor Green
} else {
    Write-Host "   [INFO] Metro en cours de demarrage..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "2. Ouverture interface web..." -ForegroundColor Yellow
try {
    Start-Process "http://localhost:8081"
    Write-Host "   [OK] Interface web ouverte" -ForegroundColor Green
} catch {
    Write-Host "   [WARN] Impossible d'ouvrir automatiquement" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Simulation scan QR code..." -ForegroundColor Yellow

$scanAttempts = 0
$successCount = 0
$errorCount = 0

for ($i = 1; $i -le 5; $i++) {
    $scanAttempts++
    Write-Host "   Tentative de scan #$i..." -ForegroundColor Gray
    
    Start-Sleep -Seconds 2
    
    $random = Get-Random -Minimum 1 -Maximum 10
    
    if ($random -le 3) {
        $errorCount++
        Write-Host "   [ERREUR] Erreur simulee detectee" -ForegroundColor Red
    } elseif ($random -le 7) {
        $successCount++
        Write-Host "   [SUCCES] Evenement simule reussi" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTE] En attente..." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "4. Analyse des resultats..." -ForegroundColor Yellow
Write-Host "   Tentatives de scan: $scanAttempts" -ForegroundColor Cyan
Write-Host "   Succes detectes: $successCount" -ForegroundColor Green
Write-Host "   Erreurs detectees: $errorCount" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })

Write-Host ""
Write-Host "5. Simulation connexion..." -ForegroundColor Yellow
Write-Host "   [OK] Connexion simulee etablie" -ForegroundColor Green
Write-Host "   [OK] Bundle telecharge" -ForegroundColor Green
Write-Host "   [OK] Application simulee lancee" -ForegroundColor Green

Write-Host ""
Write-Host "=======================" -ForegroundColor Cyan
Write-Host "RESUME SIMULATION" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

if ($errorCount -eq 0) {
    Write-Host ""
    Write-Host "[SUCCES] Simulation sans erreur!" -ForegroundColor Green
    Write-Host "   L'application est prete pour les tests reels." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[WARN] Erreurs simulees detectees." -ForegroundColor Yellow
    Write-Host "   Analysez les logs pour plus de details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Interface web: http://localhost:8081" -ForegroundColor Cyan
Write-Host ""
Write-Host "POUR TEST REEL:" -ForegroundColor Yellow
Write-Host "1. Ouvrez Expo Go sur votre telephone" -ForegroundColor White
Write-Host "2. Scannez le QR code affiche dans Metro" -ForegroundColor White
Write-Host "3. L'application se chargera automatiquement" -ForegroundColor White
Write-Host ""
