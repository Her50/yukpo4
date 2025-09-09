# 🛑 Script d'arrêt de tous les services Yukpo
# Usage: .\stop-all-services.ps1

Write-Host "🛑 Arrêt de tous les services Yukpo..." -ForegroundColor Red

# Fonction pour arrêter un processus sur un port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    if ($process) {
        Write-Host "🔄 Arrêt de $ServiceName (port $Port)..." -ForegroundColor Yellow
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Write-Host "✅ $ServiceName arrêté" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  $ServiceName n'était pas en cours d'exécution" -ForegroundColor Gray
    }
}

# Arrêter tous les services
Write-Host "🔍 Recherche et arrêt des services..." -ForegroundColor Cyan

Stop-ProcessOnPort 3001 "Backend Rust"
Stop-ProcessOnPort 5173 "Frontend React"
Stop-ProcessOnPort 8000 "Microservice Embedding"

# Arrêter tous les processus PowerShell liés à Yukpo
Write-Host "🔄 Arrêt des processus PowerShell liés à Yukpo..." -ForegroundColor Yellow
Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -eq "powershell" -and 
    $_.MainWindowTitle -match "(cargo|npm|uvicorn|python)"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Tous les services ont été arrêtés !" -ForegroundColor Green
Write-Host "💡 Vous pouvez maintenant redémarrer avec .\start-all-services.ps1" -ForegroundColor Cyan 