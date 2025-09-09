# Script simple pour libérer les ports utilisés par Yukpo
Write-Host "🔍 Libération des ports Yukpo..." -ForegroundColor Cyan

# Fonction pour arrêter un processus sur un port spécifique
function Stop-ProcessOnPort {
    param([int]$Port)
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $processId = $conn.OwningProcess
                $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
                Write-Host "🔄 Arrêt du processus $processName (PID: $processId) sur le port $Port" -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
            Write-Host "✅ Port $Port libéré" -ForegroundColor Green
        } else {
            Write-Host "✅ Port $Port déjà libre" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "⚠️ Erreur lors de la libération du port $Port : $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Libérer les ports utilisés par Yukpo
Write-Host "`n🔧 Libération du port 3001 (backend)..." -ForegroundColor Cyan
Stop-ProcessOnPort -Port 3001

Write-Host "`n🔧 Libération du port 3002 (backend alternatif)..." -ForegroundColor Cyan
Stop-ProcessOnPort -Port 3002

Write-Host "`n🔧 Libération du port 5173 (frontend)..." -ForegroundColor Cyan
Stop-ProcessOnPort -Port 5173

Write-Host "`n🔧 Libération du port 8000 (embedding)..." -ForegroundColor Cyan
Stop-ProcessOnPort -Port 8000

Write-Host "`n⏳ Attente de 3 secondes pour la libération complète..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "`n🔍 Vérification finale des ports..." -ForegroundColor Cyan
$ports = @(3001, 3002, 5173, 8000)
foreach ($port in $ports) {
    $status = if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) { "❌ Utilisé" } else { "✅ Libre" }
    Write-Host "Port $port : $status" -ForegroundColor $(if ($status -like "*Libre*") { "Green" } else { "Red" })
}

Write-Host "`n🎉 Libération des ports terminée !" -ForegroundColor Green
Write-Host "Vous pouvez maintenant redémarrer vos services." -ForegroundColor Cyan 