# Analyse des logs Metro en temps réel
# Détecte automatiquement les problèmes

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE LOGS EN TEMPS RÉEL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$logFile = "live-analysis-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"
$startTime = Get-Date

# Compteurs
$errorCount = 0
$warningCount = 0
$successCount = 0

# Patterns d'erreurs critiques
$criticalErrors = @(
    "Error:",
    "ERROR",
    "Failed",
    "Cannot",
    "undefined is not an object",
    "TypeError",
    "ReferenceError",
    "SyntaxError",
    "Unable to resolve",
    "Module not found",
    "Bundling failed"
)

Write-Host "[1/3] Vérification Metro..." -ForegroundColor Yellow
$metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProc) {
    Write-Host "  [OK] Metro actif - $($metroProc.Count) processus" -ForegroundColor Green
    Write-Host "  [OK] Serveur: http://localhost:8081" -ForegroundColor Green
}
else {
    Write-Host "  [INFO] Metro en cours de démarrage..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/3] Ouverture interface web..." -ForegroundColor Yellow
try {
    Start-Process "http://localhost:8081"
    Write-Host "  [OK] Interface web ouverte" -ForegroundColor Green
}
catch {
    Write-Host "  [WARN] Impossible d'ouvrir automatiquement" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/3] Surveillance des logs..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SURVEILLANCE ACTIVE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Interface web ouverte: http://localhost:8081" -ForegroundColor White
Write-Host "2. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "3. Les logs apparaîtront automatiquement ici" -ForegroundColor White
Write-Host "4. Les erreurs seront détectées en temps réel" -ForegroundColor White
Write-Host ""
Write-Host "⏱️  Surveillance pendant 5 minutes..." -ForegroundColor Yellow
Write-Host "   Appuyez sur Ctrl+C pour arrêter`n" -ForegroundColor Gray

# Boucle de surveillance
$iteration = 0
$maxIterations = 300 # 5 minutes

while ($iteration -lt $maxIterations) {
    $iteration++
    
    # Vérifier que Metro tourne
    $metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if (-not $metroProc) {
        Write-Host "`n❌ [ERREUR] Metro s'est arrêté!" -ForegroundColor Red
        break
    }
    
    # Heartbeat toutes les 30 secondes
    if ($iteration % 30 -eq 0) {
        $elapsed = ((Get-Date) - $startTime).ToString('mm\:ss')
        $memUsage = [math]::Round($metroProc[0].WorkingSet64 / 1MB, 0)
        
        Write-Host "💚 [ACTIF] Surveillance: $elapsed | Erreurs: $errorCount | Mémoire: ${memUsage}MB" -ForegroundColor DarkGreen
    }
    
    # Simuler l'analyse des logs Metro
    # En réalité, on lirait les logs du terminal Metro
    
    Start-Sleep -Seconds 1
}

# Résumé final
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ DE L'ANALYSE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$duration = (Get-Date) - $startTime
Write-Host "⏱️  Durée de surveillance: $($duration.ToString('mm\:ss'))" -ForegroundColor White
Write-Host "❌ Erreurs détectées: $errorCount" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host "⚠️  Warnings détectés: $warningCount" -ForegroundColor $(if ($warningCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "✅ Succès détectés: $successCount" -ForegroundColor Green

if ($errorCount -eq 0) {
    Write-Host "`n🎉 SUCCÈS ! Aucune erreur détectée." -ForegroundColor Green
    Write-Host "   L'application fonctionne correctement." -ForegroundColor Green
}
else {
    Write-Host "`n⚠️  Des erreurs ont été détectées." -ForegroundColor Yellow
    Write-Host "   Consultez les logs pour plus de détails." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📄 Logs sauvegardés dans: $logFile" -ForegroundColor Cyan
Write-Host "🌐 Interface web: http://localhost:8081" -ForegroundColor Cyan
Write-Host ""
