# Analyze logs - Simple version

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  ANALYSE DES LOGS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Chercher les fichiers de log
$logFiles = Get-ChildItem -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending

if ($logFiles.Count -eq 0) {
    Write-Host "Aucun fichier de log trouve" -ForegroundColor Gray
    Write-Host ""
    exit
}

Write-Host "Fichiers de log trouves: $($logFiles.Count)" -ForegroundColor Cyan
Write-Host ""

# Analyser le dernier log
$latestLog = $logFiles[0]
Write-Host "Analyse de: $($latestLog.Name)" -ForegroundColor Yellow
Write-Host "Taille: $([math]::Round($latestLog.Length / 1KB, 2)) KB" -ForegroundColor Gray
Write-Host ""

if (Test-Path $latestLog.FullName) {
    $content = Get-Content $latestLog.FullName -ErrorAction SilentlyContinue
    
    if ($content) {
        # Compter les erreurs
        $errors = $content | Select-String -Pattern "Error|ERROR|error" -CaseSensitive:$false
        $warnings = $content | Select-String -Pattern "Warning|WARN|warn" -CaseSensitive:$false
        
        Write-Host "Statistiques:" -ForegroundColor White
        Write-Host "  - Erreurs trouvees: $($errors.Count)" -ForegroundColor $(if ($errors.Count -eq 0) { "Green" } else { "Red" })
        Write-Host "  - Warnings trouves: $($warnings.Count)" -ForegroundColor $(if ($warnings.Count -eq 0) { "Green" } else { "Yellow" })
        Write-Host ""
        
        # Afficher les dernieres erreurs
        if ($errors.Count -gt 0) {
            Write-Host "Dernieres erreurs:" -ForegroundColor Red
            $errors | Select-Object -First 5 | ForEach-Object {
                Write-Host "  - $($_.Line.Substring(0, [Math]::Min(120, $_.Line.Length)))" -ForegroundColor Red
            }
            Write-Host ""
        } else {
            Write-Host "Aucune erreur detectee!" -ForegroundColor Green
            Write-Host ""
        }
    } else {
        Write-Host "Le fichier de log est vide" -ForegroundColor Gray
        Write-Host ""
    }
} else {
    Write-Host "Impossible de lire le fichier" -ForegroundColor Red
    Write-Host ""
}

Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

