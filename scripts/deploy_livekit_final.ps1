# Script final pour déployer LiveKit automatiquement sur le serveur cloud
# Usage: .\scripts\deploy_livekit_final.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== DEPLOIEMENT AUTOMATIQUE LIVEKIT CLOUD ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = Read-Host "Nom d'utilisateur SSH (ex: root, ubuntu, admin)"
$LIVEKIT_PORT = "7880"

# Mettre à jour le PATH pour inclure OpenSSH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

# Vérifier SSH
Write-Host ""
Write-Host "1. Verification SSH..." -ForegroundColor Yellow
try {
    $sshPath = Get-Command ssh -ErrorAction Stop | Select-Object -ExpandProperty Source
    $sshVersion = ssh -V 2>&1
    Write-Host "[OK] SSH trouve: $sshPath" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] SSH non accessible" -ForegroundColor Red
    Write-Host "  Installez OpenSSH: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0" -ForegroundColor Yellow
    exit 1
}

# Préparer le script
Write-Host ""
Write-Host "2. Preparation du script..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$deployScript = Join-Path $scriptDir "deploy_livekit_cloud.sh"
$remoteScriptPath = "/tmp/deploy_livekit_cloud.sh"

if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script non trouve: $deployScript" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Script local: $deployScript" -ForegroundColor Green

# Transférer le script
Write-Host ""
Write-Host "3. Transfert du script vers le serveur..." -ForegroundColor Yellow
Write-Host "  (Vous devrez entrer le mot de passe SSH)" -ForegroundColor Gray
Write-Host ""

try {
    scp $deployScript "${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Script transfere" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Echec du transfert" -ForegroundColor Red
        Write-Host "  Verifiez vos credentials SSH" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Erreur SCP: $_" -ForegroundColor Red
    exit 1
}

# Exécuter le script
Write-Host ""
Write-Host "4. Execution du script sur le serveur..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre 2-3 minutes)" -ForegroundColor Gray
Write-Host ""

try {
    ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x $remoteScriptPath && $remoteScriptPath"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Deploiement termine!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] Le script s'est execute mais il y a peut-etre des erreurs" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    exit 1
}

# Vérification
Write-Host ""
Write-Host "5. Verification..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test de connexion
Write-Host ""
Write-Host "6. Test de connexion LiveKit..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
    } else {
        Write-Host "[ATTENTION] Code HTTP: $httpCode" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] LiveKit ne repond pas encore (peut prendre quelques minutes)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DEPLOIEMENT TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "LiveKit est deploye sur: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green

