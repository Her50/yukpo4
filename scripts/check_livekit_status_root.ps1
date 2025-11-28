# Script pour vérifier le statut complet de LiveKit
# Usage: .\scripts\check_livekit_status_root.ps1

$ErrorActionPreference = "Continue"

Write-Host "=== VERIFICATION STATUT LIVEKIT ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = "root"
$LIVEKIT_PORT = "7880"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519"

# Configurer PATH pour SSH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

# Construire la commande SSH avec la clé
$sshArgs = @()
if (Test-Path $SSH_KEY) {
    $sshArgs = @("-i", $SSH_KEY)
}

Write-Host "1. Statut du service systemd..." -ForegroundColor Yellow
try {
    $statusCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "systemctl status livekit --no-pager")
    & ssh $statusCmd 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} catch {
    Write-Host "  [ERREUR] $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Conteneurs Docker..." -ForegroundColor Yellow
try {
    $dockerCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "docker ps -a --filter name=livekit")
    & ssh $dockerCmd 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} catch {
    Write-Host "  [ERREUR] $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Processus LiveKit..." -ForegroundColor Yellow
try {
    $procCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "ps aux | grep livekit | grep -v grep")
    & ssh $procCmd 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} catch {
    Write-Host "  [ERREUR] $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Ports en ecoute..." -ForegroundColor Yellow
try {
    $portCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "netstat -tlnp | grep 7880 || ss -tlnp | grep 7880")
    & ssh $portCmd 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
} catch {
    Write-Host "  [ERREUR] $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "5. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "  [OK] Code HTTP: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  [ERREUR] $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== FIN ===" -ForegroundColor Green

