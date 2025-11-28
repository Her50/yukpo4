# Script complet pour déployer ET démarrer LiveKit sur le serveur cloud avec ubuntu
# Usage: .\scripts\deploy_and_start_livekit_ubuntu.ps1

$ErrorActionPreference = "Continue"

Write-Host "=== DEPLOIEMENT ET DEMARRAGE LIVEKIT CLOUD ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = "ubuntu"
$LIVEKIT_PORT = "7880"
$deployScript = "scripts\deploy_livekit_cloud.sh"
$startScript = "dossier_candidature_concours\SCRIPT_DEMARRAGE_LIVEKIT.sh"
$remoteDeployPath = "/tmp/deploy_livekit_cloud.sh"
$remoteStartPath = "/tmp/start_livekit.sh"

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
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

try {
    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if ($sshCmd) {
        Write-Host "[OK] SSH trouve: $($sshCmd.Source)" -ForegroundColor Green
        
        # Vérifier version
        $sshVersion = ssh -V 2>&1
        Write-Host "[OK] Version: $sshVersion" -ForegroundColor Green
    }
    else {
        Write-Host "[ERREUR] SSH non trouve" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "[ERREUR] SSH non accessible: $_" -ForegroundColor Red
    exit 1
}

# 2. Vérifier que les scripts existent
Write-Host ""
Write-Host "2. Verification des scripts..." -ForegroundColor Yellow

if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script de deploiement non trouve: $deployScript" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Script de deploiement trouve: $deployScript" -ForegroundColor Green

if (-not (Test-Path $startScript)) {
    Write-Host "[ATTENTION] Script de demarrage non trouve: $startScript" -ForegroundColor Yellow
    Write-Host "  Utilisation du script de deploiement uniquement" -ForegroundColor Gray
    $USE_START_SCRIPT = $false
}
else {
    Write-Host "[OK] Script de demarrage trouve: $startScript" -ForegroundColor Green
    $USE_START_SCRIPT = $true
}

# 3. Transférer le script de déploiement
Write-Host ""
Write-Host "3. Transfert du script de deploiement vers le serveur..." -ForegroundColor Yellow
Write-Host "  Commande: scp $deployScript ${SERVER_USER}@${SERVER_IP}:${remoteDeployPath}" -ForegroundColor Gray

try {
    & scp $deployScript "${SERVER_USER}@${SERVER_IP}:${remoteDeployPath}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Script de deploiement transfere avec succes" -ForegroundColor Green
    }
    else {
        Write-Host "[ERREUR] Echec du transfert (code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  Verifiez vos identifiants SSH et la connexion au serveur" -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "[ERREUR] Erreur SCP: $_" -ForegroundColor Red
    exit 1
}

# 4. Transférer le script de démarrage si disponible
if ($USE_START_SCRIPT) {
    Write-Host ""
    Write-Host "4. Transfert du script de demarrage vers le serveur..." -ForegroundColor Yellow
    Write-Host "  Commande: scp $startScript ${SERVER_USER}@${SERVER_IP}:${remoteStartPath}" -ForegroundColor Gray
    
    try {
        & scp $startScript "${SERVER_USER}@${SERVER_IP}:${remoteStartPath}"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Script de demarrage transfere avec succes" -ForegroundColor Green
        }
        else {
            Write-Host "[ATTENTION] Echec du transfert du script de demarrage (code: $LASTEXITCODE)" -ForegroundColor Yellow
            Write-Host "  Utilisation du script de deploiement uniquement" -ForegroundColor Gray
            $USE_START_SCRIPT = $false
        }
    }
    catch {
        Write-Host "[ATTENTION] Erreur SCP pour script de demarrage: $_" -ForegroundColor Yellow
        $USE_START_SCRIPT = $false
    }
}

# 5. Exécuter le script de déploiement sur le serveur
Write-Host ""
Write-Host "5. Execution du script de deploiement sur le serveur..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre 2-3 minutes)" -ForegroundColor Gray
Write-Host "  Commande: ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteDeployPath && $remoteDeployPath'" -ForegroundColor Gray
Write-Host ""

try {
    & ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x $remoteDeployPath && $remoteDeployPath"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Deploiement termine avec succes!" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "[ATTENTION] Le script de deploiement s'est execute avec le code: $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "  Verifiez les logs ci-dessus pour plus de details" -ForegroundColor Yellow
    }
}
catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Commandes manuelles:" -ForegroundColor Yellow
    Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Cyan
    Write-Host "  chmod +x $remoteDeployPath && $remoteDeployPath" -ForegroundColor Cyan
    exit 1
}

# 6. Si le script de démarrage est disponible, l'exécuter aussi
if ($USE_START_SCRIPT) {
    Write-Host ""
    Write-Host "6. Execution du script de demarrage sur le serveur..." -ForegroundColor Yellow
    Write-Host "  Commande: ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteStartPath && $remoteStartPath'" -ForegroundColor Gray
    Write-Host ""
    
    try {
        & ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x $remoteStartPath && $remoteStartPath"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[OK] Demarrage termine avec succes!" -ForegroundColor Green
        }
        else {
            Write-Host ""
            Write-Host "[ATTENTION] Le script de demarrage s'est execute avec le code: $LASTEXITCODE" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host ""
        Write-Host "[ATTENTION] Erreur lors de l'execution du script de demarrage: $_" -ForegroundColor Yellow
    }
}

# 7. Vérification finale
Write-Host ""
Write-Host "7. Verification finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $status = & ssh "${SERVER_USER}@${SERVER_IP}" "docker ps --filter name=livekit-server --format '{{.Status}}'" 2>&1
    
    if ($status -match "Up") {
        Write-Host "[OK] LiveKit est en cours d'execution" -ForegroundColor Green
    }
    else {
        Write-Host "[ATTENTION] Statut LiveKit: $status" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut" -ForegroundColor Yellow
}

# Test de connexion
Write-Host ""
Write-Host "8. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
    }
    else {
        Write-Host "[ATTENTION] Code HTTP: $httpCode" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[ATTENTION] LiveKit n'est pas encore accessible (normal si le firewall n'est pas configure)" -ForegroundColor Yellow
    Write-Host "  Erreur: $_" -ForegroundColor Gray
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
Write-Host "  sudo systemctl status livekit" -ForegroundColor White
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green

