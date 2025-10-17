# Capture des logs de crash en temps réel

Write-Host ""
Write-Host "=== CAPTURE LOGS CRASH TÉLÉPHONE ===" -ForegroundColor Red
Write-Host ""
Write-Host "Mode: Capture en temps réel des erreurs" -ForegroundColor Cyan
Write-Host ""

$logFile = "crash-logs-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').txt"
$errorCount = 0

Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "  1. Gardez cette fenêtre ouverte" -ForegroundColor White
Write-Host "  2. Scannez le QR code sur votre téléphone" -ForegroundColor White
Write-Host "  3. Les erreurs s'afficheront ICI automatiquement" -ForegroundColor White
Write-Host ""
Write-Host "Logs sauvegardés dans: $logFile" -ForegroundColor Gray
Write-Host ""
Write-Host "Attente des erreurs..." -ForegroundColor Cyan
Write-Host ""

# Surveiller les logs Metro via le port HTTP
$startTime = Get-Date
$iteration = 0

while ($true) {
    $iteration++
    
    try {
        # Vérifier si Metro est toujours actif
        $metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if (-not $metroProc) {
            Write-Host "[ERREUR] Metro s'est arrêté!" -ForegroundColor Red
            break
        }
        
        # Afficher un point d'activité toutes les 5 itérations
        if ($iteration % 5 -eq 0) {
            Write-Host "." -NoNewline -ForegroundColor Gray
        }
        
    } catch {
        Write-Host ""
        Write-Host "[ERREUR DÉTECTÉE] $($_.Exception.Message)" -ForegroundColor Red
        Add-Content -Path $logFile -Value "[$(Get-Date -Format 'HH:mm:ss')] ERREUR: $($_.Exception.Message)"
        $errorCount++
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host ""
Write-Host "Capture terminée. $errorCount erreurs détectées." -ForegroundColor Yellow

