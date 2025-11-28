# Script PowerShell de démarrage automatique LiveKit avec Docker
# Usage: .\scripts\start_livekit_auto.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Démarrage automatique du serveur LiveKit..." -ForegroundColor Green

# Configuration depuis les variables d'environnement ou valeurs par défaut
$LIVEKIT_IP = if ($env:LIVEKIT_IP) { $env:LIVEKIT_IP } else { "46.224.14.85" }
$LIVEKIT_PORT = if ($env:LIVEKIT_PORT) { $env:LIVEKIT_PORT } else { "7880" }
$LIVEKIT_API_KEY = if ($env:LIVEKIT_API_KEY) { $env:LIVEKIT_API_KEY } else { "APIPHE9xDv5RPaP" }
$LIVEKIT_API_SECRET = if ($env:LIVEKIT_API_SECRET) { $env:LIVEKIT_API_SECRET } else { "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE" }

# Répertoire de travail
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$CONFIG_DIR = Join-Path $PROJECT_ROOT "config"
$LIVEKIT_CONFIG = Join-Path $CONFIG_DIR "livekit.yaml"

# Créer le répertoire config s'il n'existe pas
if (-not (Test-Path $CONFIG_DIR)) {
    New-Item -ItemType Directory -Path $CONFIG_DIR | Out-Null
    Write-Host "✅ Répertoire config créé: $CONFIG_DIR" -ForegroundColor Green
}

# Vérifier si un fichier de config existe déjà
$EXISTING_CONFIG = Join-Path $PROJECT_ROOT "livekit-config-sample.yaml"
if (Test-Path $EXISTING_CONFIG) {
    Write-Host "📋 Utilisation de la configuration existante: $EXISTING_CONFIG" -ForegroundColor Yellow
    Copy-Item $EXISTING_CONFIG $LIVEKIT_CONFIG -Force
    Write-Host "✅ Configuration copiée vers: $LIVEKIT_CONFIG" -ForegroundColor Green
}
else {
    # Créer le fichier de configuration
    Write-Host "📝 Création du fichier de configuration..." -ForegroundColor Yellow
    $configContent = @"
port: ${LIVEKIT_PORT}
bind_addresses:
  - "0.0.0.0"
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  stun_servers:
    - stun:stun.l.google.com:19302
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
redis:
  address: ""
  username: ""
  password: ""
turn:
  enabled: true
  domain: ""
  tls_port: 5349
  udp_port: 3478
  external_tls: false
  external_udp: false
  relay_port_range_start: 50000
  relay_port_range_end: 60000
log_level: info
development: true
"@
    Set-Content -Path $LIVEKIT_CONFIG -Value $configContent -Encoding UTF8
    Write-Host "✅ Configuration créée: $LIVEKIT_CONFIG" -ForegroundColor Green
}

# Vérifier si Docker est installé
Write-Host "🔍 Vérification de Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker détecté: $dockerVersion" -ForegroundColor Green
    }
    else {
        throw "Docker non disponible"
    }
}
catch {
    Write-Host "❌ Docker n'est pas installé ou non accessible" -ForegroundColor Red
    Write-Host "💡 Installez Docker Desktop pour Windows: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Arrêter le conteneur existant s'il existe
Write-Host "🛑 Vérification des conteneurs existants..." -ForegroundColor Yellow
$existingContainer = docker ps -a --filter "name=livekit-server" --format "{{.Names}}" 2>&1
if ($existingContainer -and $existingContainer -eq "livekit-server") {
    Write-Host "🛑 Arrêt du conteneur existant..." -ForegroundColor Yellow
    docker stop livekit-server 2>&1 | Out-Null
    docker rm livekit-server 2>&1 | Out-Null
    Write-Host "✅ Conteneur existant supprimé" -ForegroundColor Green
}

# Vérifier si docker-compose est disponible
$USE_COMPOSE = $false
$COMPOSE_FILE = Join-Path $SCRIPT_DIR "docker-compose.livekit.yml"
if (Test-Path $COMPOSE_FILE) {
    try {
        docker compose version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $USE_COMPOSE = $true
            Write-Host "✅ docker-compose détecté, utilisation de: $COMPOSE_FILE" -ForegroundColor Green
        }
    }
    catch {
        try {
            docker-compose version 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $USE_COMPOSE = $true
                Write-Host "✅ docker-compose détecté (ancienne version)" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "⚠️ docker-compose non disponible, utilisation de docker run" -ForegroundColor Yellow
        }
    }
}

# Démarrer LiveKit
if ($USE_COMPOSE) {
    Write-Host "🐳 Démarrage avec docker-compose..." -ForegroundColor Yellow
    Push-Location $SCRIPT_DIR
    try {
        docker compose -f docker-compose.livekit.yml up -d 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Services démarrés avec docker-compose" -ForegroundColor Green
        }
        else {
            throw "Erreur docker-compose"
        }
    }
    catch {
        Write-Host "❌ Erreur avec docker-compose, tentative avec docker run..." -ForegroundColor Red
        $USE_COMPOSE = $false
    }
    Pop-Location
}

if (-not $USE_COMPOSE) {
    Write-Host "🐳 Démarrage avec Docker..." -ForegroundColor Yellow
    
    # Convertir le chemin Windows en chemin Docker
    $dockerConfigPath = $LIVEKIT_CONFIG -replace '\\', '/'
    if ($dockerConfigPath -match '^[A-Z]:') {
        # Chemin Windows absolu, convertir en format Docker
        $drive = $dockerConfigPath.Substring(0, 1).ToLower()
        $path = $dockerConfigPath.Substring(2)
        $dockerConfigPath = "/$drive$path"
    }
    
    docker run -d `
        --name livekit-server `
        --restart unless-stopped `
        -p "${LIVEKIT_PORT}:${LIVEKIT_PORT}" `
        -p "7881:7881" `
        -p "50000-60000:50000-60000/udp" `
        -v "${LIVEKIT_CONFIG}:C:/etc/livekit.yaml:ro" `
        livekit/livekit-server:latest `
        --config C:/etc/livekit.yaml `
        --dev 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conteneur LiveKit démarré" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Erreur lors du démarrage du conteneur" -ForegroundColor Red
        Write-Host "💡 Vérifiez que Docker Desktop est démarré" -ForegroundColor Yellow
        exit 1
    }
}

# Attendre que le serveur démarre
Write-Host "⏳ Attente du démarrage du serveur (5 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Vérifier le statut
Write-Host "📊 Vérification du statut..." -ForegroundColor Yellow
if ($USE_COMPOSE) {
    Push-Location $SCRIPT_DIR
    docker compose -f docker-compose.livekit.yml ps
    Pop-Location
}
else {
    docker ps --filter "name=livekit-server" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Test de connexion
Write-Host "🔍 Test de connexion..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${LIVEKIT_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "✅ Serveur LiveKit accessible sur http://${LIVEKIT_IP}:${LIVEKIT_PORT}/" -ForegroundColor Green
        Write-Host "✅ Le backend détectera automatiquement le serveur lors du prochain diagnostic" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Le serveur répond avec le code: $httpCode" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ Le serveur ne répond pas encore (normal si démarrage en cours)" -ForegroundColor Yellow
    Write-Host "📋 Vérifiez les logs:" -ForegroundColor Yellow
    if ($USE_COMPOSE) {
        Write-Host "   docker compose -f scripts/docker-compose.livekit.yml logs -f" -ForegroundColor Cyan
    }
    else {
        Write-Host "   docker logs -f livekit-server" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "✅ Démarrage terminé !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Commandes utiles:" -ForegroundColor Cyan
if ($USE_COMPOSE) {
    Write-Host "   - Logs: docker compose -f scripts/docker-compose.livekit.yml logs -f" -ForegroundColor White
    Write-Host "   - Arrêter: docker compose -f scripts/docker-compose.livekit.yml down" -ForegroundColor White
    Write-Host "   - Redémarrer: docker compose -f scripts/docker-compose.livekit.yml restart" -ForegroundColor White
    Write-Host "   - Statut: docker compose -f scripts/docker-compose.livekit.yml ps" -ForegroundColor White
}
else {
    Write-Host "   - Logs: docker logs -f livekit-server" -ForegroundColor White
    Write-Host "   - Arrêter: docker stop livekit-server" -ForegroundColor White
    Write-Host "   - Redémarrer: docker restart livekit-server" -ForegroundColor White
    Write-Host "   - Statut: docker ps | grep livekit" -ForegroundColor White
}
Write-Host "   - Test: curl -v http://${LIVEKIT_IP}:${LIVEKIT_PORT}/" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Le backend effectuera automatiquement un diagnostic dans les prochaines minutes" -ForegroundColor Green

