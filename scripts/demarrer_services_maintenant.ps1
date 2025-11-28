# Script pour démarrer tous les services maintenant que Docker est accessible
# Usage: .\scripts\demarrer_services_maintenant.ps1

Write-Host "=== DEMARRAGE DES SERVICES ===" -ForegroundColor Cyan
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

# Vérifier les conteneurs existants
Write-Host ""
Write-Host "2. Verification des conteneurs existants..." -ForegroundColor Yellow
$containers = docker ps -a --format "{{.Names}}\t{{.Status}}" 2>&1
if ($containers) {
    Write-Host "Conteneurs trouves:" -ForegroundColor Cyan
    $containers | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
}
else {
    Write-Host "[INFO] Aucun conteneur trouve" -ForegroundColor Gray
}

# Vérifier docker-compose
Write-Host ""
Write-Host "3. Verification de docker-compose..." -ForegroundColor Yellow
$useCompose = $false
$composeCmd = ""

try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $useCompose = $true
        $composeCmd = "docker compose"
        Write-Host "[OK] docker compose detecte (nouvelle version)" -ForegroundColor Green
    }
}
catch {
    try {
        docker-compose version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $useCompose = $true
            $composeCmd = "docker-compose"
            Write-Host "[OK] docker-compose detecte (ancienne version)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "[ERREUR] docker-compose non trouve" -ForegroundColor Red
        Write-Host "  Installez docker-compose ou utilisez 'docker compose' (nouvelle version)" -ForegroundColor Yellow
        exit 1
    }
}

# Démarrer les services
Write-Host ""
Write-Host "4. Demarrage des services avec docker-compose..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$composeFile = Join-Path $projectRoot "docker-compose.yml"

if (-not (Test-Path $composeFile)) {
    Write-Host "[ERREUR] docker-compose.yml non trouve: $composeFile" -ForegroundColor Red
    exit 1
}

Write-Host "  Fichier: $composeFile" -ForegroundColor Gray
Write-Host "  Commande: $composeCmd up -d" -ForegroundColor Gray
Write-Host ""

Push-Location $projectRoot

try {
    # Démarrer les services
    Invoke-Expression "$composeCmd up -d" 2>&1 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Services demarres!" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "[ERREUR] Erreur lors du demarrage des services" -ForegroundColor Red
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

# Attendre que les services démarrent
Write-Host ""
Write-Host "5. Attente du demarrage des services (5 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Vérifier le statut
Write-Host ""
Write-Host "6. Statut des services..." -ForegroundColor Yellow
Invoke-Expression "$composeCmd ps" 2>&1 | ForEach-Object {
    Write-Host "  $_" -ForegroundColor White
}

# Vérifier les services spécifiques
Write-Host ""
Write-Host "7. Verification des services specifiques..." -ForegroundColor Yellow

# PostgreSQL
$postgresStatus = docker ps --filter "name=postgres" --format "{{.Status}}" 2>&1
if ($postgresStatus -match "Up") {
    Write-Host "[OK] PostgreSQL est en cours d'execution" -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] PostgreSQL ne semble pas etre en cours d'execution" -ForegroundColor Yellow
}

# LiveKit
$livekitStatus = docker ps --filter "name=livekit" --format "{{.Status}}" 2>&1
if ($livekitStatus -match "Up") {
    Write-Host "[OK] LiveKit est en cours d'execution" -ForegroundColor Green
    
    # Test de connexion
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:7880/" -Method Get -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 404 -or $response.StatusCode -eq 405) {
            Write-Host "[OK] LiveKit est accessible sur http://localhost:7880/" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "[ATTENTION] LiveKit ne repond pas encore (normal si demarrage en cours)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[ATTENTION] LiveKit ne semble pas etre en cours d'execution" -ForegroundColor Yellow
}

Pop-Location

Write-Host ""
Write-Host "=== DEMARRAGE TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "  - Voir les logs: $composeCmd logs -f" -ForegroundColor White
Write-Host "  - Arreter: $composeCmd down" -ForegroundColor White
Write-Host "  - Redemarrer: $composeCmd restart" -ForegroundColor White
Write-Host "  - Statut: $composeCmd ps" -ForegroundColor White
Write-Host ""
Write-Host "Services disponibles:" -ForegroundColor Cyan
Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "  - LiveKit: http://localhost:7880/" -ForegroundColor White
Write-Host "  - Backend: http://localhost:3001/" -ForegroundColor White
Write-Host "  - Frontend: http://localhost:3000/" -ForegroundColor White

