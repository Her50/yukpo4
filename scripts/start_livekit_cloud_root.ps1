# Script pour démarrer LiveKit sur le serveur cloud avec root (utilise la clé SSH existante)
# Usage: .\scripts\start_livekit_cloud_root.ps1

$ErrorActionPreference = "Continue"

Write-Host "=== DEMARRAGE LIVEKIT CLOUD (ROOT) ===" -ForegroundColor Cyan
Write-Host ""

# Configuration (basée sur inventory.ini)
$SERVER_IP = "46.224.14.85"
$SERVER_USER = "root"
$LIVEKIT_PORT = "7880"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Serveur: ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "  Port LiveKit: $LIVEKIT_PORT" -ForegroundColor White
Write-Host "  Cle SSH: $SSH_KEY" -ForegroundColor White
Write-Host ""

# Aller dans le répertoire du projet
Set-Location "C:\Users\23767\yukpomnang2"
Write-Host "[OK] Repertoire: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 1. Vérifier la clé SSH
Write-Host "1. Verification de la cle SSH..." -ForegroundColor Yellow

if (Test-Path $SSH_KEY) {
    Write-Host "[OK] Cle SSH trouvee: $SSH_KEY" -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] Cle SSH non trouvee: $SSH_KEY" -ForegroundColor Yellow
    Write-Host "  Le script utilisera l'authentification par mot de passe si necessaire" -ForegroundColor Gray
}

# Configurer PATH pour SSH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

# 2. Vérifier SSH
Write-Host ""
Write-Host "2. Verification SSH..." -ForegroundColor Yellow

try {
    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if ($sshCmd) {
        Write-Host "[OK] SSH trouve: $($sshCmd.Source)" -ForegroundColor Green
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

# 3. Vérifier si LiveKit est déjà en cours d'exécution
Write-Host ""
Write-Host "3. Verification du statut LiveKit..." -ForegroundColor Yellow

# Construire la commande SSH avec la clé si elle existe
$sshArgs = @()
if (Test-Path $SSH_KEY) {
    $sshArgs = @("-i", $SSH_KEY)
}

try {
    $statusCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "docker ps --filter name=livekit-server --format '{{.Status}}'")
    $status = & ssh $statusCmd 2>&1
    
    if ($status -match "Up") {
        Write-Host "[OK] LiveKit est deja en cours d'execution!" -ForegroundColor Green
        Write-Host "  Statut: $status" -ForegroundColor Gray
        
        # Test de connexion
        Write-Host ""
        Write-Host "Test de connexion..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        
        try {
            $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404 -or $response.StatusCode -eq 405) {
                Write-Host "[OK] LiveKit est accessible sur http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "[ATTENTION] LiveKit ne repond pas encore" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "Commandes utiles:" -ForegroundColor Cyan
        Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
        Write-Host "  docker logs -f livekit-server" -ForegroundColor White
        Write-Host "  systemctl status livekit" -ForegroundColor White
        exit 0
    }
}
catch {
    Write-Host "[INFO] LiveKit n'est pas en cours d'execution" -ForegroundColor Gray
}

# 4. Vérifier le service systemd
Write-Host ""
Write-Host "4. Verification du service systemd..." -ForegroundColor Yellow

try {
    $serviceCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "systemctl is-active livekit")
    $serviceStatus = & ssh $serviceCmd 2>&1
    
    if ($serviceStatus -match "active") {
        Write-Host "[OK] Service systemd est actif" -ForegroundColor Green
        Write-Host "  Redemarrage du service..." -ForegroundColor Gray
        $restartCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "systemctl restart livekit")
        & ssh $restartCmd 2>&1 | Out-Null
    }
    else {
        Write-Host "[INFO] Service systemd n'est pas actif, demarrage..." -ForegroundColor Gray
        $startCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "systemctl start livekit")
        & ssh $startCmd 2>&1 | Out-Null
    }
}
catch {
    Write-Host "[ATTENTION] Impossible de gerer le service systemd, tentative avec Docker..." -ForegroundColor Yellow
}

# 5. Démarrer LiveKit avec Docker (si le service systemd n'existe pas)
Write-Host ""
Write-Host "5. Demarrage de LiveKit avec Docker..." -ForegroundColor Yellow

try {
    # Vérifier si le conteneur existe
    $checkCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "docker ps -a --filter name=livekit-server --format '{{.Names}}'")
    $containerExists = & ssh $checkCmd 2>&1
    
    if ($containerExists -match "livekit-server") {
        Write-Host "  Demarrage du conteneur existant..." -ForegroundColor Gray
        $startCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "docker start livekit-server")
        & ssh $startCmd 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] LiveKit demarre!" -ForegroundColor Green
        }
        else {
            Write-Host "[ERREUR] Echec du demarrage (code: $LASTEXITCODE)" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "[ATTENTION] Le conteneur n'existe pas encore" -ForegroundColor Yellow
        Write-Host "  Utilisez le script de deploiement d'abord:" -ForegroundColor Yellow
        Write-Host "    .\scripts\deploy_livekit_cloud_noninteractive.ps1 -ServerUser root" -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    exit 1
}

# 6. Attendre le démarrage
Write-Host ""
Write-Host "6. Attente du demarrage (10 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 7. Vérifier le statut
Write-Host ""
Write-Host "7. Verification du statut..." -ForegroundColor Yellow

try {
    $statusCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "docker ps --filter name=livekit-server --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    $status = & ssh $statusCmd 2>&1
    
    if ($status -match "livekit-server") {
        Write-Host "[OK] LiveKit est en cours d'execution:" -ForegroundColor Green
        Write-Host $status -ForegroundColor White
    }
    else {
        Write-Host "[ATTENTION] Le conteneur ne semble pas etre en cours d'execution" -ForegroundColor Yellow
        Write-Host "  Verification des logs..." -ForegroundColor Yellow
        $logsCmd = $sshArgs + @("${SERVER_USER}@${SERVER_IP}", "docker logs livekit-server --tail 20")
        & ssh $logsCmd 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    }
}
catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut" -ForegroundColor Yellow
}

# 8. Test de connexion
Write-Host ""
Write-Host "8. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
        Write-Host "  Code HTTP: $httpCode" -ForegroundColor Gray
    }
    else {
        Write-Host "[ATTENTION] Code HTTP: $httpCode" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[ATTENTION] LiveKit n'est pas encore accessible depuis l'exterieur" -ForegroundColor Yellow
    Write-Host "  Cela peut prendre quelques secondes supplementaires" -ForegroundColor Gray
    Write-Host "  Ou verifiez le firewall sur le serveur" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== DEMARRAGE TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "LiveKit devrait etre accessible sur: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "  docker logs -f livekit-server" -ForegroundColor White
Write-Host "  docker ps --filter name=livekit-server" -ForegroundColor White
Write-Host "  systemctl status livekit" -ForegroundColor White
Write-Host "  systemctl restart livekit" -ForegroundColor White
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green

