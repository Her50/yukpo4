# Script pour démarrer LiveKit maintenant
# À exécuter dans un NOUVEAU PowerShell où Docker est accessible
# Usage: .\scripts\demarrer_livekit_maintenant.ps1

Write-Host "=== DEMARRAGE LIVEKIT ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier Docker
Write-Host "1. Verification de Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker est accessible: $dockerVersion" -ForegroundColor Green
    }
    else {
        Write-Host "[ERREUR] Docker n'est pas accessible" -ForegroundColor Red
        Write-Host "  Ouvrez un NOUVEAU PowerShell et reessayez" -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "[ERREUR] Docker n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "  Ouvrez un NOUVEAU PowerShell et reessayez" -ForegroundColor Yellow
    exit 1
}

# Vérifier docker-compose
Write-Host ""
Write-Host "2. Verification de docker-compose..." -ForegroundColor Yellow
$composeCmd = ""
try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $composeCmd = "docker compose"
        Write-Host "[OK] docker compose detecte" -ForegroundColor Green
    }
}
catch {
    try {
        docker-compose version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $composeCmd = "docker-compose"
            Write-Host "[OK] docker-compose detecte" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "[ERREUR] docker-compose non trouve" -ForegroundColor Red
        exit 1
    }
}

# Vérifier les conteneurs LiveKit existants
Write-Host ""
Write-Host "3. Verification des conteneurs LiveKit existants..." -ForegroundColor Yellow
$existingContainers = docker ps -a --filter "name=livekit" --format "{{.Names}}\t{{.Status}}" 2>&1
if ($existingContainers) {
    Write-Host "Conteneurs LiveKit trouves:" -ForegroundColor Cyan
    $existingContainers | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    
    # Vérifier si déjà en cours d'exécution
    $running = docker ps --filter "name=livekit" --format "{{.Names}}" 2>&1
    if ($running -and $running -match "livekit") {
        Write-Host "[OK] LiveKit est deja en cours d'execution!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Test de connexion..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:7880/" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404 -or $response.StatusCode -eq 405) {
                Write-Host "[OK] LiveKit est accessible sur http://localhost:7880/" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "[ATTENTION] LiveKit ne repond pas encore" -ForegroundColor Yellow
        }
        exit 0
    }
}

# Démarrer LiveKit avec docker-compose
Write-Host ""
Write-Host "4. Demarrage de LiveKit avec docker-compose..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$composeFile = Join-Path $projectRoot "docker-compose.yml"

if (-not (Test-Path $composeFile)) {
    Write-Host "[ERREUR] docker-compose.yml non trouve: $composeFile" -ForegroundColor Red
    exit 1
}

Write-Host "  Fichier: $composeFile" -ForegroundColor Gray
Write-Host "  Commande: $composeCmd up -d livekit" -ForegroundColor Gray
Write-Host ""

Push-Location $projectRoot

try {
    # Démarrer LiveKit
    Write-Host "Demarrage en cours..." -ForegroundColor Gray
    Invoke-Expression "$composeCmd up -d livekit" 2>&1 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] LiveKit demarre!" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "[ERREUR] Erreur lors du demarrage de LiveKit" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Attendre que LiveKit démarre
Write-Host ""
Write-Host "5. Attente du demarrage de LiveKit (10 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Vérifier le statut
Write-Host ""
Write-Host "6. Verification du statut..." -ForegroundColor Yellow
$livekitStatus = docker ps --filter "name=livekit" --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1
if ($livekitStatus) {
    Write-Host "[OK] LiveKit est en cours d'execution:" -ForegroundColor Green
    $livekitStatus | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
}
else {
    Write-Host "[ATTENTION] LiveKit ne semble pas etre en cours d'execution" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Verification des logs..." -ForegroundColor Yellow
    Invoke-Expression "$composeCmd logs livekit --tail 20" 2>&1 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
}

# Test de connexion
Write-Host ""
Write-Host "7. Test de connexion LiveKit..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://localhost:7880/" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible sur http://localhost:7880/" -ForegroundColor Green
        Write-Host "  Code HTTP: $httpCode" -ForegroundColor Gray
    }
    else {
        Write-Host "[ATTENTION] LiveKit repond avec le code: $httpCode" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[ATTENTION] LiveKit ne repond pas encore (normal si demarrage en cours)" -ForegroundColor Yellow
    Write-Host "  Erreur: $_" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Attendez encore 10-20 secondes et reessayez:" -ForegroundColor Cyan
    Write-Host "  curl http://localhost:7880/" -ForegroundColor White
}

Pop-Location

Write-Host ""
Write-Host "=== DEMARRAGE TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "  - Logs: $composeCmd logs -f livekit" -ForegroundColor White
Write-Host "  - Arreter: $composeCmd stop livekit" -ForegroundColor White
Write-Host "  - Redemarrer: $composeCmd restart livekit" -ForegroundColor White
Write-Host "  - Statut: docker ps --filter name=livekit" -ForegroundColor White
Write-Host ""
Write-Host "LiveKit est accessible sur:" -ForegroundColor Cyan
Write-Host "  - HTTP: http://localhost:7880/" -ForegroundColor White
Write-Host "  - WebRTC: ws://localhost:7880/" -ForegroundColor White
Write-Host "  - API: http://localhost:7880/twirp/" -ForegroundColor White
Write-Host ""
Write-Host "Le backend detectera automatiquement LiveKit lors du prochain diagnostic" -ForegroundColor Green

