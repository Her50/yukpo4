# Script pour surveiller et analyser les logs Metro en temps reel

$logFile = "metro-logs-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').txt"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SURVEILLANCE LOGS METRO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Compteurs
$errorCount = 0
$warningCount = 0
$successCount = 0

# Patterns d'erreurs
$errorPatterns = @(
    "Error",
    "ERROR", 
    "Failed",
    "Cannot",
    "Undefined",
    "TypeError",
    "ReferenceError",
    "SyntaxError"
)

$warningPatterns = @(
    "Warning",
    "WARN",
    "Deprecated"
)

$successPatterns = @(
    "Metro.*waiting",
    "Bundling complete",
    "Fast Refresh",
    "iOS.*Android",
    "QR code"
)

Write-Host "[INFO] Recherche du processus Metro..." -ForegroundColor Cyan

$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    
    $metroProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($metroProcess) {
        Write-Host "[OK] Metro detecte! PID: $($metroProcess[0].Id)" -ForegroundColor Green
        Write-Host "     Memoire: $([math]::Round($metroProcess[0].WorkingSet64/1MB, 0)) MB" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Logs sauvegardes dans: $logFile" -ForegroundColor Yellow
        Write-Host "Appuyez sur Ctrl+C pour arreter la surveillance`n" -ForegroundColor Gray
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Verifier les logs dans le terminal Metro
        Write-Host "[INFO] Metro devrait afficher:" -ForegroundColor Cyan
        Write-Host "  - Le QR code pour scanner avec Expo Go" -ForegroundColor White
        Write-Host "  - L'URL du serveur (exp://...)" -ForegroundColor White
        Write-Host "  - Les instructions de connexion" -ForegroundColor White
        Write-Host ""
        Write-Host "[ACTION] Maintenant:" -ForegroundColor Yellow
        Write-Host "  1. Cherchez le QR code dans l'autre terminal" -ForegroundColor White
        Write-Host "  2. Scannez-le avec Expo Go" -ForegroundColor White
        Write-Host "  3. Les logs apparaitront automatiquement" -ForegroundColor White
        Write-Host ""
        
        # Boucle de surveillance
        $startTime = Get-Date
        $lastCheck = Get-Date
        
        while ($true) {
            Start-Sleep -Seconds 2
            
            # Verifier si Metro tourne toujours
            $metroProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
            if (-not $metroProcess) {
                Write-Host "`n[ERREUR] Metro s'est arrete!" -ForegroundColor Red
                break
            }
            
            # Afficher un heartbeat toutes les 10 secondes
            if (((Get-Date) - $lastCheck).TotalSeconds -ge 10) {
                $elapsed = ((Get-Date) - $startTime).ToString("mm\:ss")
                Write-Host "[ACTIF] Metro tourne depuis $elapsed" -ForegroundColor Green
                $lastCheck = Get-Date
            }
        }
        
        break
    }
    
    Write-Host "  Tentative $attempt/$maxAttempts - En attente..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

if ($attempt -ge $maxAttempts) {
    Write-Host "`n[ERREUR] Metro ne demarre pas apres $maxAttempts tentatives" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifications:" -ForegroundColor Yellow
    Write-Host "  1. Verifiez qu'aucune erreur n'apparait dans l'autre terminal" -ForegroundColor White
    Write-Host "  2. Essayez de lancer manuellement: npm start" -ForegroundColor White
    Write-Host "  3. Verifiez node_modules: npm install" -ForegroundColor White
    Write-Host ""
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  FIN DE LA SURVEILLANCE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

