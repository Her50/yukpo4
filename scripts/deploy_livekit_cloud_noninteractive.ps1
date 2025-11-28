# Script non-interactif pour déployer LiveKit
# Usage: .\scripts\deploy_livekit_cloud_noninteractive.ps1 -ServerUser "root"
# Usage: .\scripts\deploy_livekit_cloud_noninteractive.ps1 -ServerUser "ubuntu"

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUser = "root"
)

$ErrorActionPreference = "Continue"

Write-Host "=== DEPLOIEMENT LIVEKIT CLOUD (NON-INTERACTIF) ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = $ServerUser
$LIVEKIT_PORT = "7880"
$deployScript = "scripts\deploy_livekit_cloud.sh"
$remoteScriptPath = "/tmp/deploy_livekit_cloud.sh"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Serveur: ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "  Port LiveKit: $LIVEKIT_PORT" -ForegroundColor White
Write-Host ""

# Aller dans le répertoire du projet
Set-Location "C:\Users\23767\yukpomnang2"
Write-Host "[OK] Repertoire: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 1. Vérifier SSH
Write-Host "1. Verification SSH..." -ForegroundColor Yellow

# Configurer PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

try {
    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if ($sshCmd) {
        Write-Host "[OK] SSH trouve: $($sshCmd.Source)" -ForegroundColor Green
        
        # Vérifier version
        $sshVersion = ssh -V 2>&1
        Write-Host "[OK] Version: $sshVersion" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] SSH non trouve" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERREUR] SSH non accessible: $_" -ForegroundColor Red
    exit 1
}

# 2. Vérifier que le script existe
Write-Host ""
Write-Host "2. Verification script de deploiement..." -ForegroundColor Yellow
if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script non trouve: $deployScript" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Script trouve: $deployScript" -ForegroundColor Green

# 3. Transférer le script
Write-Host ""
Write-Host "3. Transfert du script vers le serveur..." -ForegroundColor Yellow
Write-Host "  Commande: scp $deployScript ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}" -ForegroundColor Gray

try {
    & scp $deployScript "${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Script transfere avec succes" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Echec du transfert (code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  Verifiez vos identifiants SSH et la connexion au serveur" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Erreur SCP: $_" -ForegroundColor Red
    exit 1
}

# 4. Exécuter le script sur le serveur
Write-Host ""
Write-Host "4. Execution du script sur le serveur..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre 2-3 minutes)" -ForegroundColor Gray
Write-Host "  Commande: ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteScriptPath && $remoteScriptPath'" -ForegroundColor Gray
Write-Host ""

try {
    & ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x $remoteScriptPath && $remoteScriptPath"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Deploiement termine avec succes!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] Le script s'est execute avec le code: $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "  Verifiez les logs ci-dessus pour plus de details" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Commandes manuelles:" -ForegroundColor Yellow
    Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Cyan
    Write-Host "  chmod +x $remoteScriptPath && $remoteScriptPath" -ForegroundColor Cyan
    exit 1
}

# 5. Vérification finale
Write-Host ""
Write-Host "5. Verification finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $status = & ssh "${SERVER_USER}@${SERVER_IP}" "docker ps --filter name=livekit-server --format '{{.Status}}'" 2>&1
    
    if ($status -match "Up") {
        Write-Host "[OK] LiveKit est en cours d'execution" -ForegroundColor Green
    } else {
        Write-Host "[ATTENTION] Statut LiveKit: $status" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut" -ForegroundColor Yellow
}

# Test de connexion
Write-Host ""
Write-Host "6. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

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
    Write-Host "[ATTENTION] LiveKit n'est pas encore accessible (normal si le firewall n'est pas configure)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DEPLOIEMENT TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "LiveKit devrait etre accessible sur: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "  docker logs -f livekit-server" -ForegroundColor White
Write-Host "  docker ps --filter name=livekit-server" -ForegroundColor White

