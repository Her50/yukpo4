# Script pour forcer la libération du port 3001
Write-Host "🔫 FORCE KILL du port 3001..." -ForegroundColor Red

# Méthode 1: Utiliser netstat pour trouver le processus
Write-Host "`n🔍 Recherche du processus sur le port 3001..." -ForegroundColor Cyan
try {
    $netstat = netstat -ano | Select-String ":3001"
    if ($netstat) {
        Write-Host "Processus trouvé sur le port 3001:" -ForegroundColor Yellow
        Write-Host $netstat -ForegroundColor White
        
        # Extraire le PID
        $pid = ($netstat -split '\s+')[-1]
        Write-Host "PID extrait: $pid" -ForegroundColor Yellow
        
        # Tuer le processus
        Write-Host "🔄 Arrêt forcé du processus PID: $pid" -ForegroundColor Red
        taskkill /PID $pid /F
        Write-Host "✅ Processus tué avec succès" -ForegroundColor Green
    } else {
        Write-Host "✅ Aucun processus trouvé sur le port 3001" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Erreur avec netstat: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Méthode 2: Utiliser Get-NetTCPConnection (PowerShell natif)
Write-Host "`n🔍 Vérification avec Get-NetTCPConnection..." -ForegroundColor Cyan
try {
    $connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
            Write-Host "🔄 Arrêt forcé de $processName (PID: $processId)" -ForegroundColor Red
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
        Write-Host "✅ Tous les processus sur le port 3001 ont été arrêtés" -ForegroundColor Green
    } else {
        Write-Host "✅ Port 3001 libre (Get-NetTCPConnection)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Erreur avec Get-NetTCPConnection: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Méthode 3: Utiliser tasklist pour vérifier les processus Rust/Cargo
Write-Host "`n🔍 Recherche des processus Rust/Cargo..." -ForegroundColor Cyan
try {
    $rustProcesses = Get-Process | Where-Object {$_.ProcessName -like "*rust*" -or $_.ProcessName -like "*cargo*" -or $_.ProcessName -like "*yukpomnang*"}
    if ($rustProcesses) {
        Write-Host "Processus Rust/Cargo trouvés:" -ForegroundColor Yellow
        foreach ($proc in $rustProcesses) {
            Write-Host "  - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor White
        }
        
        Write-Host "🔄 Arrêt de tous les processus Rust/Cargo..." -ForegroundColor Red
        $rustProcesses | Stop-Process -Force
        Write-Host "✅ Tous les processus Rust/Cargo arrêtés" -ForegroundColor Green
    } else {
        Write-Host "✅ Aucun processus Rust/Cargo trouvé" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Erreur lors de la recherche des processus Rust: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Attendre et vérifier
Write-Host "`n⏳ Attente de 5 secondes..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Vérification finale
Write-Host "`n🔍 Vérification finale du port 3001..." -ForegroundColor Cyan
$finalCheck = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($finalCheck) {
    Write-Host "❌ Le port 3001 est encore utilisé!" -ForegroundColor Red
    Write-Host "Détails:" -ForegroundColor Yellow
    $finalCheck | Format-Table -AutoSize
} else {
    Write-Host "✅ SUCCÈS! Le port 3001 est maintenant libre!" -ForegroundColor Green
    Write-Host "Vous pouvez maintenant lancer votre backend!" -ForegroundColor Cyan
}

Write-Host "`n🎯 Script terminé!" -ForegroundColor Cyan 