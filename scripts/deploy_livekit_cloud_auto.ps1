# Script PowerShell pour déployer automatiquement LiveKit sur le serveur cloud
# Usage: .\scripts\deploy_livekit_cloud_auto.ps1
# Nécessite: SSH et accès au serveur 46.224.14.85

$ErrorActionPreference = "Stop"

Write-Host "=== DEPLOIEMENT AUTOMATIQUE LIVEKIT CLOUD ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = Read-Host "Nom d'utilisateur SSH pour $SERVER_IP (ex: root, ubuntu, admin)"
$LIVEKIT_PORT = "7880"
$API_KEY = "APIPHE9xDv5RPaP"
$API_SECRET = "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Serveur: $SERVER_USER@$SERVER_IP" -ForegroundColor White
Write-Host "  Port LiveKit: $LIVEKIT_PORT" -ForegroundColor White
Write-Host ""

# Vérifier SSH
Write-Host "1. Verification de SSH..." -ForegroundColor Yellow
try {
    $sshVersion = ssh -V 2>&1
    Write-Host "[OK] SSH disponible: $sshVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERREUR] SSH n'est pas installe ou non accessible" -ForegroundColor Red
    Write-Host "  Installez OpenSSH ou utilisez PuTTY/WinSCP" -ForegroundColor Yellow
    exit 1
}

# Créer le script de déploiement temporaire
Write-Host ""
Write-Host "2. Preparation du script de deploiement..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$deployScript = Join-Path $scriptDir "deploy_livekit_cloud.sh"

if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script de deploiement non trouve: $deployScript" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Script trouve: $deployScript" -ForegroundColor Green

# Créer la commande SSH complète
Write-Host ""
Write-Host "3. Connexion SSH et deploiement..." -ForegroundColor Yellow
Write-Host "  (Vous devrez peut-etre entrer le mot de passe SSH)" -ForegroundColor Gray
Write-Host ""

# Commande pour transférer et exécuter le script
$remoteScriptPath = "/tmp/deploy_livekit_cloud.sh"

# Option 1: Utiliser SCP pour transférer puis SSH pour exécuter
Write-Host "  Transfert du script vers le serveur..." -ForegroundColor Gray
try {
    # Transférer le script
    $scpCommand = "scp `"$deployScript`" ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}"
    Write-Host "  Commande: $scpCommand" -ForegroundColor DarkGray
    Invoke-Expression $scpCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Script transfere" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Erreur lors du transfert" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Erreur SCP: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "ALTERNATIVE: Transferez manuellement le script:" -ForegroundColor Yellow
    Write-Host "  scp $deployScript ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}" -ForegroundColor Cyan
    Write-Host "  Puis executez: ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteScriptPath && $remoteScriptPath'" -ForegroundColor Cyan
    exit 1
}

# Exécuter le script sur le serveur
Write-Host ""
Write-Host "  Execution du script sur le serveur..." -ForegroundColor Gray
Write-Host "  (Cela peut prendre 2-3 minutes)" -ForegroundColor Gray
Write-Host ""

$sshCommand = "ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteScriptPath && $remoteScriptPath'"

try {
    Invoke-Expression $sshCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Deploiement termine!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] Le script s'est execute mais il y a peut-etre des erreurs" -ForegroundColor Yellow
        Write-Host "  Verifiez les logs ci-dessus" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "ALTERNATIVE: Connectez-vous manuellement:" -ForegroundColor Yellow
    Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Cyan
    Write-Host "  Puis executez: chmod +x $remoteScriptPath && $remoteScriptPath" -ForegroundColor Cyan
    exit 1
}

# Vérification finale
Write-Host ""
Write-Host "4. Verification finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $testCommand = "ssh ${SERVER_USER}@${SERVER_IP} 'docker ps --filter name=livekit-server --format `"{{.Status}}`"'"
    $status = Invoke-Expression $testCommand 2>&1
    
    if ($status -match "Up") {
        Write-Host "[OK] LiveKit est en cours d'execution sur le serveur" -ForegroundColor Green
    } else {
        Write-Host "[ATTENTION] Statut LiveKit: $status" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut" -ForegroundColor Yellow
}

# Test de connexion depuis l'extérieur
Write-Host ""
Write-Host "5. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible depuis l'exterieur!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
        Write-Host "  Code HTTP: $httpCode" -ForegroundColor Gray
    } else {
        Write-Host "[ATTENTION] LiveKit repond avec le code: $httpCode" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] LiveKit n'est pas encore accessible depuis l'exterieur" -ForegroundColor Yellow
    Write-Host "  Erreur: $_" -ForegroundColor Gray
    Write-Host "  Cela peut prendre quelques minutes pour que le firewall se mette a jour" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== DEPLOIEMENT TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "LiveKit devrait etre accessible sur: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles (sur le serveur):" -ForegroundColor Yellow
Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "  docker logs -f livekit-server" -ForegroundColor White
Write-Host "  docker ps --filter name=livekit-server" -ForegroundColor White
Write-Host "  sudo systemctl status livekit" -ForegroundColor White

