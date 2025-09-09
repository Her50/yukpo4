# Script de vérification des logs du serveur backend
# Ce script aide à identifier l'erreur exacte de l'API /api/user/me

Write-Host "Vérification des logs du serveur backend" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

Write-Host "`n1. Vérification de l'état du serveur..." -ForegroundColor Yellow

# Vérifier si le serveur backend est en cours d'exécution
$backendProcesses = Get-Process | Where-Object { $_.ProcessName -like "*rust*" -or $_.ProcessName -like "*backend*" -or $_.ProcessName -like "*cargo*" }

if ($backendProcesses) {
    Write-Host "   Processus backend détectés:" -ForegroundColor Green
    foreach ($process in $backendProcesses) {
        Write-Host "   - $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun processus backend détecté" -ForegroundColor Yellow
}

Write-Host "`n2. Vérification des logs du serveur..." -ForegroundColor Yellow

# Vérifier s'il y a des fichiers de log dans le répertoire backend
$backendDir = "backend"
$logFiles = @()

if (Test-Path $backendDir) {
    Write-Host "   Répertoire backend trouvé" -ForegroundColor Green
    
    # Chercher des fichiers de log
    $logFiles = Get-ChildItem -Path $backendDir -Recurse -Include "*.log", "*.txt", "*.out", "*.err" | Where-Object { $_.Length -gt 0 }
    
    if ($logFiles) {
        Write-Host "   Fichiers de log trouvés:" -ForegroundColor Green
        foreach ($logFile in $logFiles) {
            Write-Host "   - $($logFile.FullName) ($($logFile.Length) bytes)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   Aucun fichier de log trouvé" -ForegroundColor Yellow
    }
} else {
    Write-Host "   Répertoire backend introuvable" -ForegroundColor Red
}

Write-Host "`n3. Vérification des logs système..." -ForegroundColor Yellow

# Vérifier les logs Windows Event Viewer pour les erreurs d'application
Write-Host "   Vérification des logs d'événements Windows..." -ForegroundColor Gray

try {
    $recentErrors = Get-WinEvent -LogName Application -MaxEvents 10 -ErrorAction SilentlyContinue | Where-Object { $_.Level -eq 2 -or $_.Level -eq 1 } | Where-Object { $_.Message -like "*rust*" -or $_.Message -like "*backend*" -or $_.Message -like "*500*" }
    
    if ($recentErrors) {
        Write-Host "   Erreurs récentes détectées:" -ForegroundColor Red
        foreach ($error in $recentErrors) {
            Write-Host "   - $($error.TimeCreated): $($error.Message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   Aucune erreur récente détectée dans les logs système" -ForegroundColor Green
    }
} catch {
    Write-Host "   Impossible d'accéder aux logs système: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n4. Instructions pour vérifier les logs manuellement..." -ForegroundColor Yellow

Write-Host "   Pour identifier l'erreur exacte de l'API /api/user/me:" -ForegroundColor Blue
Write-Host "   1. Ouvrez un terminal dans le répertoire backend" -ForegroundColor White
Write-Host "   2. Lancez le serveur avec: cargo run" -ForegroundColor White
Write-Host "   3. Dans un autre terminal, testez l'API:" -ForegroundColor White
Write-Host "      curl -H 'Authorization: Bearer VOTRE_TOKEN' http://localhost:3001/api/user/me" -ForegroundColor White
Write-Host "   4. Regardez les logs dans le terminal du serveur" -ForegroundColor White

Write-Host "`n5. Vérification de la configuration..." -ForegroundColor Yellow

# Vérifier les fichiers de configuration
$configFiles = @("backend/Cargo.toml", "backend/src/config/*.toml", "backend/.env", "backend/.env.local")

foreach ($configFile in $configFiles) {
    if (Test-Path $configFile) {
        Write-Host "   Configuration trouvée: $configFile" -ForegroundColor Green
    }
}

Write-Host "`n6. Test rapide de l'API..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/healthz" -Method Get -TimeoutSec 5
    Write-Host "   Serveur backend accessible: $response" -ForegroundColor Green
} catch {
    Write-Host "   Serveur backend inaccessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== VÉRIFICATION TERMINÉE ===" -ForegroundColor Cyan
Write-Host "`nRÉSUMÉ:" -ForegroundColor Yellow
Write-Host "1. Processus backend: $($backendProcesses.Count) détecté(s)" -ForegroundColor White
Write-Host "2. Fichiers de log: $($logFiles.Count) trouvé(s)" -ForegroundColor White
Write-Host "3. Erreurs système: $($recentErrors.Count) détectée(s)" -ForegroundColor White

Write-Host "`nPROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Lancez le serveur backend avec 'cargo run' pour voir les logs en temps réel" -ForegroundColor White
Write-Host "2. Testez l'API /api/user/me pour déclencher l'erreur" -ForegroundColor White
Write-Host "3. Analysez les logs du serveur pour identifier la cause exacte" -ForegroundColor White
Write-Host "4. Le problème peut être dans le code Rust ou une colonne manquante" -ForegroundColor White 