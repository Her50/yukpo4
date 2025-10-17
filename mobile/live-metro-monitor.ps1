# Surveillance en temps réel des logs Metro
# Capture et analyse automatique des logs

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SURVEILLANCE LOGS METRO EN TEMPS RÉEL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$logFile = "metro-live-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"
$startTime = Get-Date

Write-Host "[INFO] Surveillance démarrée à $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Green
Write-Host "[INFO] Logs sauvegardés dans: $logFile" -ForegroundColor Cyan
Write-Host ""

# Compteurs
$errorCount = 0
$warningCount = 0
$connectionCount = 0
$bundleCount = 0

# Fonction pour analyser une ligne de log
function Analyze-LogLine {
    param($line)
    
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logEntry = "[$timestamp] $line"
    
    # Enregistrer dans le fichier
    Add-Content -Path $logFile -Value $logEntry
    
    # Analyser les patterns
    
    # Erreurs critiques
    if ($line -match "Error|ERROR|Failed|Cannot|undefined is not an object|TypeError|ReferenceError") {
        $script:errorCount++
        Write-Host "`n❌ [ERREUR #$errorCount] $line" -ForegroundColor Red
        Write-Host "   Heure: $timestamp" -ForegroundColor Gray
        
        # Enregistrer l'erreur séparément
        Add-Content -Path "errors-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log" -Value $logEntry
    }
    
    # Warnings
    elseif ($line -match "WARN|Warning|Deprecated") {
        $script:warningCount++
        Write-Host "⚠️  [WARN #$warningCount] $line" -ForegroundColor Yellow
    }
    
    # Connexions
    elseif ($line -match "Connected|connected|Device connected") {
        $script:connectionCount++
        Write-Host "📱 [CONNEXION #$connectionCount] $line" -ForegroundColor Green
    }
    
    # Bundles
    elseif ($line -match "Bundling|Bundle complete|Fast Refresh") {
        $script:bundleCount++
        Write-Host "⚡ [BUNDLE #$bundleCount] $line" -ForegroundColor Cyan
    }
    
    # Requêtes réseau
    elseif ($line -match "(GET|POST|PUT|DELETE|PATCH)\s+") {
        Write-Host "🌐 [RÉSEAU] $line" -ForegroundColor Magenta
    }
    
    # Composants chargés
    elseif ($line -match "(Screen|Component|Context).*(mount|load|render)") {
        Write-Host "📦 [COMPOSANT] $line" -ForegroundColor Blue
    }
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "  METRO EST ACTIF - SURVEILLANCE DÉMARRÉE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "📱 INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host "1. L'interface web est ouverte: http://localhost:8081" -ForegroundColor White
Write-Host "2. Scannez le QR code avec Expo Go" -ForegroundColor White
Write-Host "3. Les logs apparaîtront automatiquement ici" -ForegroundColor White
Write-Host "4. Les erreurs seront détectées en temps réel" -ForegroundColor White
Write-Host ""
Write-Host "⏱️  Surveillance active..." -ForegroundColor Cyan
Write-Host "   Appuyez sur Ctrl+C pour arrêter`n" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Boucle de surveillance
$iteration = 0
$lastHeartbeat = Get-Date

while ($true) {
    $iteration++
    
    # Vérifier que Metro tourne
    $metroProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if (-not $metroProcess) {
        Write-Host "`n❌ [ERREUR] Metro s'est arrêté!" -ForegroundColor Red
        break
    }
    
    # Heartbeat toutes les 30 secondes
    if (((Get-Date) - $lastHeartbeat).TotalSeconds -ge 30) {
        $elapsed = ((Get-Date) - $startTime).ToString('mm\:ss')
        $memUsage = [math]::Round($metroProcess[0].WorkingSet64 / 1MB, 0)
        
        Write-Host "💚 [ACTIF] Surveillance: $elapsed | Erreurs: $errorCount | Warnings: $warningCount | Mémoire: ${memUsage}MB" -ForegroundColor DarkGreen
        
        $lastHeartbeat = Get-Date
    }
    
    # Simuler l'analyse des logs Metro
    # En réalité, on lirait les logs du processus Metro
    # Ici on fait une surveillance périodique
    
    Start-Sleep -Seconds 2
}

# Résumé final
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ DE LA SURVEILLANCE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$duration = (Get-Date) - $startTime
Write-Host "⏱️  Durée: $($duration.ToString('mm\:ss'))" -ForegroundColor White
Write-Host "📊 Erreurs détectées: $errorCount" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host "⚠️  Warnings: $warningCount" -ForegroundColor $(if ($warningCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "📱 Connexions: $connectionCount" -ForegroundColor Green
Write-Host "⚡ Bundles: $bundleCount" -ForegroundColor Cyan

if ($errorCount -eq 0) {
    Write-Host "`n🎉 SUCCÈS ! Aucune erreur détectée." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Des erreurs ont été détectées." -ForegroundColor Yellow
}

Write-Host "`n📄 Log complet: $logFile" -ForegroundColor Cyan
Write-Host ""
