# Script simple pour démarrer LiveKit sur le serveur cloud (tout est déjà configuré)
# Usage: .\scripts\start_livekit_cloud_ubuntu.ps1

$ErrorActionPreference = "Continue"

Write-Host "=== DEMARRAGE LIVEKIT CLOUD ===" -ForegroundColor Cyan
Write-Host ""

# Configuration (déjà configurée)
$SERVER_IP = "46.224.14.85"
$SERVER_USER = "ubuntu"
$LIVEKIT_PORT = "7880"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Serveur: ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
Write-Host "  Port LiveKit: $LIVEKIT_PORT" -ForegroundColor White
Write-Host ""

# Configurer PATH pour SSH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

# 1. Vérifier si LiveKit est déjà en cours d'exécution
Write-Host "1. Verification du statut LiveKit..." -ForegroundColor Yellow

try {
    $status = & ssh "${SERVER_USER}@${SERVER_IP}" "docker ps --filter name=livekit-server --format '{{.Status}}'" 2>&1
    
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
        } catch {
            Write-Host "[ATTENTION] LiveKit ne repond pas encore" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "Commandes utiles:" -ForegroundColor Cyan
        Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor White
        Write-Host "  docker logs -f livekit-server" -ForegroundColor White
        Write-Host "  docker restart livekit-server" -ForegroundColor White
        exit 0
    }
} catch {
    Write-Host "[INFO] LiveKit n'est pas en cours d'execution" -ForegroundColor Gray
}

# 2. Démarrer LiveKit avec Docker
Write-Host ""
Write-Host "2. Demarrage de LiveKit..." -ForegroundColor Yellow

try {
    # Vérifier si le conteneur existe
    $containerExists = & ssh "${SERVER_USER}@${SERVER_IP}" "docker ps -a --filter name=livekit-server --format '{{.Names}}'" 2>&1
    
    if ($containerExists -match "livekit-server") {
        Write-Host "  Demarrage du conteneur existant..." -ForegroundColor Gray
        & ssh "${SERVER_USER}@${SERVER_IP}" "docker start livekit-server" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    } else {
        Write-Host "  Le conteneur n'existe pas encore" -ForegroundColor Yellow
        Write-Host "  Utilisez le script de deploiement d'abord:" -ForegroundColor Yellow
        Write-Host "    .\scripts\deploy_livekit_cloud_noninteractive.ps1 -ServerUser ubuntu" -ForegroundColor Cyan
        exit 1
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] LiveKit demarre!" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Echec du demarrage (code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    exit 1
}

# 3. Attendre le démarrage
Write-Host ""
Write-Host "3. Attente du demarrage (10 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 4. Vérifier le statut
Write-Host ""
Write-Host "4. Verification du statut..." -ForegroundColor Yellow

try {
    $status = & ssh "${SERVER_USER}@${SERVER_IP}" "docker ps --filter name=livekit-server --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>&1
    
    if ($status -match "livekit-server") {
        Write-Host "[OK] LiveKit est en cours d'execution:" -ForegroundColor Green
        Write-Host $status -ForegroundColor White
    } else {
        Write-Host "[ATTENTION] Le conteneur ne semble pas etre en cours d'execution" -ForegroundColor Yellow
        Write-Host "  Verification des logs..." -ForegroundColor Yellow
        & ssh "${SERVER_USER}@${SERVER_IP}" "docker logs livekit-server --tail 20" 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    }
} catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut" -ForegroundColor Yellow
}

# 5. Test de connexion
Write-Host ""
Write-Host "5. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
        Write-Host "  Code HTTP: $httpCode" -ForegroundColor Gray
    } else {
        Write-Host "[ATTENTION] Code HTTP: $httpCode" -ForegroundColor Yellow
    }
} catch {
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
Write-Host "  docker restart livekit-server" -ForegroundColor White
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green

