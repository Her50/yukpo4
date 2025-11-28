# Script pour vérifier Docker et démarrer tous les services
# Usage: .\scripts\verifier_docker_et_demarrer.ps1

Write-Host "Verification de Docker et demarrage des services..." -ForegroundColor Green
Write-Host ""

# Fonction pour vérifier Docker
function Test-DockerReady {
    try {
        $result = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    catch {
        return $false
    }
    return $false
}

# Attendre que Docker soit prêt
Write-Host "Attente que Docker soit accessible..." -ForegroundColor Yellow
$maxWait = 60 # 60 secondes maximum
$waited = 0
$dockerReady = $false

while ($waited -lt $maxWait -and -not $dockerReady) {
    if (Test-DockerReady) {
        $dockerReady = $true
        $dockerVersion = docker --version 2>&1
        Write-Host "[OK] Docker est accessible: $dockerVersion" -ForegroundColor Green
        break
    }
    
    Start-Sleep -Seconds 2
    $waited += 2
    
    if ($waited % 10 -eq 0) {
        Write-Host "   Attente... ($waited/$maxWait secondes)" -ForegroundColor Gray
    }
}

if (-not $dockerReady) {
    Write-Host "[ERREUR] Docker n'est pas accessible apres $maxWait secondes" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez:" -ForegroundColor Yellow
    Write-Host "1. Docker Desktop est demarre (icone dans la barre des taches)" -ForegroundColor Cyan
    Write-Host "2. L'icone Docker n'a plus de spinner (Docker est pret)" -ForegroundColor Cyan
    Write-Host "3. Redemarrez PowerShell apres avoir demarre Docker Desktop" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "Verification des conteneurs existants..." -ForegroundColor Yellow

# Vérifier les conteneurs
$containers = docker ps -a --format "{{.Names}}\t{{.Status}}" 2>&1
if ($containers) {
    Write-Host "Conteneurs trouves:" -ForegroundColor Cyan
    $containers | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
}
else {
    Write-Host "Aucun conteneur trouve" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Demarrage des services avec docker-compose..." -ForegroundColor Yellow

# Vérifier docker-compose
$useCompose = $false
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
        Write-Host "[ATTENTION] docker-compose non trouve, utilisation de docker run" -ForegroundColor Yellow
    }
}

if ($useCompose) {
    # Démarrer avec docker-compose
    Write-Host "Demarrage des services..." -ForegroundColor Yellow
    Push-Location $PSScriptRoot\..
    
    try {
        Invoke-Expression "$composeCmd up -d" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Services demarres" -ForegroundColor Green
            Write-Host ""
            Write-Host "Statut des services:" -ForegroundColor Cyan
            Invoke-Expression "$composeCmd ps"
        }
        else {
            Write-Host "[ERREUR] Erreur lors du demarrage des services" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "[ERREUR] Erreur: $_" -ForegroundColor Red
    }
    
    Pop-Location
}
else {
    Write-Host "[INFO] docker-compose non disponible" -ForegroundColor Yellow
    Write-Host "Vous pouvez demarrer les services manuellement avec:" -ForegroundColor Cyan
    Write-Host "  docker-compose up -d" -ForegroundColor White
}

Write-Host ""
Write-Host "Verification de PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$postgresStatus = docker ps --filter "name=postgres" --format "{{.Status}}" 2>&1
if ($postgresStatus -match "Up") {
    Write-Host "[OK] PostgreSQL est en cours d'execution" -ForegroundColor Green
}
else {
    Write-Host "[ATTENTION] PostgreSQL ne semble pas etre en cours d'execution" -ForegroundColor Yellow
    Write-Host "  Status: $postgresStatus" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Verification de LiveKit..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$livekitStatus = docker ps --filter "name=livekit" --format "{{.Status}}" 2>&1
if ($livekitStatus -match "Up") {
    Write-Host "[OK] LiveKit est en cours d'execution" -ForegroundColor Green
    
    # Test de connexion
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
    Write-Host "  Status: $livekitStatus" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Pour demarrer LiveKit:" -ForegroundColor Cyan
    Write-Host "  .\scripts\restart_livekit.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "  - Voir les logs: docker-compose logs -f" -ForegroundColor White
Write-Host "  - Arreter: docker-compose down" -ForegroundColor White
Write-Host "  - Redemarrer: docker-compose restart" -ForegroundColor White
Write-Host "  - Statut: docker-compose ps" -ForegroundColor White

