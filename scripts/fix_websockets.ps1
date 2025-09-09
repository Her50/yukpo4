# Script de correction des WebSockets
Write-Host "CORRECTION DES WEBSOCKETS" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

Write-Host "`n🎯 DIAGNOSTIC DES WEBSOCKETS:" -ForegroundColor Yellow

Write-Host "`n1. Verification des processus backend..." -ForegroundColor Yellow
$backendProcesses = Get-Process | Where-Object {$_.ProcessName -like "*yukpomnang*" -or $_.ProcessName -like "*cargo*"}
if ($backendProcesses) {
    Write-Host "   Processus backend detectes:" -ForegroundColor Green
    foreach ($proc in $backendProcesses) {
        Write-Host "   - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Gray
    }
} else {
    Write-Host "   Aucun processus backend detecte" -ForegroundColor Red
}

Write-Host "`n2. Test de connexion WebSocket..." -ForegroundColor Yellow
$wsUrl = "ws://localhost:3001/ws"

try {
    Write-Host "   Test de connexion WebSocket a $wsUrl..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri "http://localhost:3001/healthz" -Method Get -TimeoutSec 10
    Write-Host "   ✅ Serveur backend accessible" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Serveur backend inaccessible" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Verification des routes WebSocket..." -ForegroundColor Yellow
Write-Host "   Recherche des routes WebSocket dans le code backend..." -ForegroundColor White

Write-Host "`n4. INSTRUCTIONS DE CORRECTION:" -ForegroundColor Yellow
Write-Host "`n📋 ETAPES POUR CORRIGER LES WEBSOCKETS:" -ForegroundColor White
Write-Host "1. Verifier que le serveur backend est en cours d'execution" -ForegroundColor White
Write-Host "2. Verifier les routes WebSocket dans le code backend" -ForegroundColor White
Write-Host "3. Verifier la configuration WebSocket dans le frontend" -ForegroundColor White
Write-Host "4. Tester la connexion WebSocket" -ForegroundColor White

Write-Host "`n=== DIAGNOSTIC WEBSOCKET TERMINE ===" -ForegroundColor Cyan 