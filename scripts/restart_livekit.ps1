# Script PowerShell pour redémarrer LiveKit automatiquement
# Utilise les fichiers de configuration existants
# Usage: .\scripts\restart_livekit.ps1

$ErrorActionPreference = "Stop"

Write-Host "Redemarrage automatique du serveur LiveKit..." -ForegroundColor Green

# Configuration depuis les variables d'environnement ou valeurs par défaut
$LIVEKIT_IP = if ($env:LIVEKIT_API_URL) { ($env:LIVEKIT_API_URL -replace 'http://|https://', '').Split(':')[0] } else { "46.224.14.85" }
$LIVEKIT_PORT = if ($env:LIVEKIT_API_URL) { 
    $port = ($env:LIVEKIT_API_URL -replace 'http://|https://', '').Split(':')[1]
    if ($port) { $port } else { "7880" }
} else { "7880" }
$LIVEKIT_API_KEY = if ($env:LIVEKIT_API_KEY) { $env:LIVEKIT_API_KEY } else { "APIPHE9xDv5RPaP" }
$LIVEKIT_API_SECRET = if ($env:LIVEKIT_API_SECRET) { $env:LIVEKIT_API_SECRET } else { "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE" }

# Répertoire de travail
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$CONFIG_DIR = Join-Path $PROJECT_ROOT "config"
$LIVEKIT_CONFIG = Join-Path $CONFIG_DIR "livekit.yaml"

# Vérifier les fichiers de config existants
$EXISTING_CONFIG = Join-Path $PROJECT_ROOT "livekit-config-sample.yaml"
$DOCKER_COMPOSE_ROOT = Join-Path $PROJECT_ROOT "docker-compose.yml"
$DOCKER_COMPOSE_SCRIPT = Join-Path $SCRIPT_DIR "docker-compose.livekit.yml"

Write-Host "Recherche de configurations existantes..." -ForegroundColor Yellow

# Vérifier si docker-compose.yml à la racine contient livekit
$useDockerCompose = $false
if (Test-Path $DOCKER_COMPOSE_ROOT) {
    $composeContent = Get-Content $DOCKER_COMPOSE_ROOT -Raw
    if ($composeContent -match "livekit") {
        Write-Host "[OK] docker-compose.yml trouve avec service livekit" -ForegroundColor Green
        $useDockerCompose = $true
        $COMPOSE_FILE = $DOCKER_COMPOSE_ROOT
    }
}

# Sinon vérifier docker-compose.livekit.yml dans scripts
if (-not $useDockerCompose -and (Test-Path $DOCKER_COMPOSE_SCRIPT)) {
    Write-Host "[OK] docker-compose.livekit.yml trouve dans scripts" -ForegroundColor Green
    $useDockerCompose = $true
    $COMPOSE_FILE = $DOCKER_COMPOSE_SCRIPT
}

# Créer le répertoire config s'il n'existe pas
if (-not (Test-Path $CONFIG_DIR)) {
    New-Item -ItemType Directory -Path $CONFIG_DIR | Out-Null
}

# Utiliser la config existante si disponible
if (Test-Path $EXISTING_CONFIG) {
    Write-Host "Utilisation de la configuration existante: $EXISTING_CONFIG" -ForegroundColor Yellow
    if (-not (Test-Path $LIVEKIT_CONFIG)) {
        Copy-Item $EXISTING_CONFIG $LIVEKIT_CONFIG -Force
        Write-Host "[OK] Configuration copiee vers: $LIVEKIT_CONFIG" -ForegroundColor Green
    }
    
    # Mettre à jour les clés dans la config
    $configContent = Get-Content $LIVEKIT_CONFIG -Raw
    if ($configContent -notmatch $LIVEKIT_API_KEY) {
        Write-Host "Mise a jour des cles API dans la configuration..." -ForegroundColor Yellow
        # Remplacer les clés par défaut
        $configContent = $configContent -replace "key1:\s*secret1", "${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}"
        $configContent = $configContent -replace "key2:\s*secret2", ""
        Set-Content -Path $LIVEKIT_CONFIG -Value $configContent -Encoding UTF8
    }
} elseif (-not (Test-Path $LIVEKIT_CONFIG)) {
    # Créer une nouvelle configuration
    Write-Host "Creation d'une nouvelle configuration..." -ForegroundColor Yellow
    $configLines = @(
        "port: ${LIVEKIT_PORT}",
        "bind_addresses:",
        "  - `"0.0.0.0`"",
        "rtc:",
        "  tcp_port: 7881",
        "  port_range_start: 50000",
        "  port_range_end: 60000",
        "  use_external_ip: true",
        "  stun_servers:",
        "    - stun:stun.l.google.com:19302",
        "keys:",
        "  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}",
        "redis:",
        "  address: `"`"",
        "  username: `"`"",
        "  password: `"`"",
        "turn:",
        "  enabled: true",
        "  domain: `"`"",
        "  tls_port: 5349",
        "  udp_port: 3478",
        "  external_tls: false",
        "  external_udp: false",
        "  relay_port_range_start: 50000",
        "  relay_port_range_end: 60000",
        "log_level: info",
        "development: true"
    )
    $configContent = $configLines -join "`n"
    Set-Content -Path $LIVEKIT_CONFIG -Value $configContent -Encoding UTF8
    Write-Host "Configuration creee: $LIVEKIT_CONFIG" -ForegroundColor Green
}

# Vérifier Docker
Write-Host "Verification de Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker detecte: $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker non disponible"
    }
} catch {
    Write-Host "[ERREUR] Docker n'est pas installe ou non accessible" -ForegroundColor Red
    Write-Host "Installez Docker Desktop pour Windows: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Arrêter les conteneurs existants
Write-Host "Arret des conteneurs LiveKit existants..." -ForegroundColor Yellow
if ($useDockerCompose) {
    Push-Location (Split-Path -Parent $COMPOSE_FILE)
    try {
        docker compose -f (Split-Path -Leaf $COMPOSE_FILE) down 2>&1 | Out-Null
        Write-Host "[OK] Conteneurs arretes" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Aucun conteneur à arrêter" -ForegroundColor Yellow
    }
    Pop-Location
} else {
    $existingContainer = docker ps -a --filter "name=livekit" --format "{{.Names}}" 2>&1
    if ($existingContainer -and $existingContainer -match "livekit") {
        Write-Host "Arret du conteneur existant: $existingContainer" -ForegroundColor Yellow
        docker stop $existingContainer 2>&1 | Out-Null
        docker rm $existingContainer 2>&1 | Out-Null
        Write-Host "[OK] Conteneur existant supprime" -ForegroundColor Green
    }
}

# Démarrer LiveKit
Write-Host "Demarrage de LiveKit..." -ForegroundColor Yellow

if ($useDockerCompose) {
    Push-Location (Split-Path -Parent $COMPOSE_FILE)
    try {
        # Utiliser docker compose (nouvelle version) ou docker-compose (ancienne)
        $composeCmd = "docker compose"
        docker compose version 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $composeCmd = "docker-compose"
        }
        
        Write-Host "Utilisation de: $composeCmd -f $(Split-Path -Leaf $COMPOSE_FILE)" -ForegroundColor Cyan
        Invoke-Expression "$composeCmd -f $(Split-Path -Leaf $COMPOSE_FILE) up -d" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Services demarres avec docker-compose" -ForegroundColor Green
        } else {
            throw "Erreur docker-compose"
        }
    } catch {
        Write-Host "[ERREUR] Erreur avec docker-compose, tentative avec docker run..." -ForegroundColor Red
        $useDockerCompose = $false
    }
    Pop-Location
}

if (-not $useDockerCompose) {
    Write-Host "Demarrage avec docker run..." -ForegroundColor Yellow
    
    # Convertir le chemin Windows pour Docker
    $dockerConfigPath = $LIVEKIT_CONFIG.Replace('\', '/')
    
    docker run -d `
        --name livekit-server `
        --restart unless-stopped `
        -p "${LIVEKIT_PORT}:${LIVEKIT_PORT}" `
        -p "7881:7881" `
        -p "50000-60000:50000-60000/udp" `
        -v "${LIVEKIT_CONFIG}:/etc/livekit.yaml:ro" `
        livekit/livekit-server:latest `
        --config /etc/livekit.yaml `
        --dev 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Conteneur LiveKit demarre" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Erreur lors du demarrage du conteneur" -ForegroundColor Red
        Write-Host "Verifiez que Docker Desktop est demarre" -ForegroundColor Yellow
        exit 1
    }
}

# Attendre le démarrage
Write-Host "Attente du demarrage (5 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Vérifier le statut
Write-Host "Statut des conteneurs:" -ForegroundColor Yellow
if ($useDockerCompose) {
    Push-Location (Split-Path -Parent $COMPOSE_FILE)
    docker compose -f (Split-Path -Leaf $COMPOSE_FILE) ps
    Pop-Location
} else {
    docker ps --filter "name=livekit" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Test de connexion
Write-Host "Test de connexion..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${LIVEKIT_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] Serveur LiveKit accessible sur http://${LIVEKIT_IP}:${LIVEKIT_PORT}/" -ForegroundColor Green
        Write-Host "[OK] Le backend detectera automatiquement le serveur lors du prochain diagnostic" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Le serveur répond avec le code: $httpCode" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Le serveur ne répond pas encore (normal si démarrage en cours)" -ForegroundColor Yellow
    Write-Host "Verifiez les logs:" -ForegroundColor Yellow
    if ($useDockerCompose) {
        Write-Host "   docker compose -f $COMPOSE_FILE logs -f livekit" -ForegroundColor Cyan
    } else {
        Write-Host "   docker logs -f livekit-server" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "[OK] Redemarrage termine !" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
if ($useDockerCompose) {
    Write-Host "   - Logs: docker compose -f $COMPOSE_FILE logs -f livekit" -ForegroundColor White
    Write-Host "   - Arrêter: docker compose -f $COMPOSE_FILE down" -ForegroundColor White
    Write-Host "   - Redémarrer: docker compose -f $COMPOSE_FILE restart livekit" -ForegroundColor White
    Write-Host "   - Statut: docker compose -f $COMPOSE_FILE ps" -ForegroundColor White
} else {
    Write-Host "   - Logs: docker logs -f livekit-server" -ForegroundColor White
    Write-Host "   - Arrêter: docker stop livekit-server" -ForegroundColor White
    Write-Host "   - Redémarrer: docker restart livekit-server" -ForegroundColor White
    Write-Host "   - Statut: docker ps | grep livekit" -ForegroundColor White
}
Write-Host "   - Test: curl http://${LIVEKIT_IP}:${LIVEKIT_PORT}/" -ForegroundColor White
Write-Host ""
Write-Host "Le backend effectuera automatiquement un diagnostic dans les prochaines minutes" -ForegroundColor Green

