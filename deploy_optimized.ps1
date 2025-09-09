# Script de déploiement optimisé pour Yukpo
# Ce script déploie l'application avec toutes les optimisations de performance

param(
    [string]$Environment = "production",
    [switch]$SkipTests,
    [switch]$Force,
    [string]$ConfigPath = "config/optimization.toml"
)

Write-Host "🚀 Déploiement optimisé Yukpo - Environnement: $Environment" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Configuration des variables d'environnement pour les optimisations
$envVars = @{
    # Cache Redis
    "CACHE_DEFAULT_TTL" = "300"
    "CACHE_SERVICES_TTL" = "600"
    "CACHE_USERS_TTL" = "1800"
    "CACHE_EXCHANGES_TTL" = "300"
    "CACHE_MAX_ENTRIES" = "10000"
    "CACHE_MAX_MEMORY_SIZE" = "104857600"  # 100MB

    # Base de données
    "DB_POOL_SIZE" = "10"
    "DB_CONNECT_TIMEOUT" = "30"
    "DB_ACQUIRE_TIMEOUT" = "30"
    "DB_IDLE_TIMEOUT" = "600"
    "DB_MAX_QUERY_SIZE" = "1048576"  # 1MB
    "DB_ENABLE_PREPARED_STATEMENTS" = "true"
    "DB_ENABLE_SLOW_QUERY_LOG" = "true"
    "DB_SLOW_QUERY_THRESHOLD" = "1000"

    # Matching d'échanges
    "MATCHING_MIN_SCORE_THRESHOLD" = "0.4"
    "MATCHING_EARLY_STOP_THRESHOLD" = "0.9"
    "MATCHING_BATCH_SIZE" = "50"
    "MATCHING_MAX_CANDIDATES" = "1000"
    "MATCHING_DUPLICATE_PROTECTION_DELAY" = "600"
    "MATCHING_ENABLE_REPUTATION_CACHE" = "true"
    "MATCHING_REPUTATION_CACHE_TTL" = "3600"

    # API
    "API_RATE_LIMIT_PER_MINUTE" = "100"
    "API_MAX_PAYLOAD_SIZE" = "10485760"  # 10MB
    "API_REQUEST_TIMEOUT" = "30"
    "API_ENABLE_COMPRESSION" = "true"
    "API_ENABLE_RESPONSE_CACHE" = "true"
    "API_RESPONSE_CACHE_TTL" = "300"

    # Tâches en arrière-plan
    "BACKGROUND_CACHE_CLEANUP_INTERVAL" = "300"
    "BACKGROUND_SERVICE_DEACTIVATION_INTERVAL" = "3600"
    "BACKGROUND_SCORE_UPDATE_INTERVAL" = "1800"
    "BACKGROUND_WORKER_COUNT" = "4"
    "BACKGROUND_TASK_QUEUE_SIZE" = "1000"
}

# Fonction pour vérifier les prérequis
function Test-Prerequisites {
    Write-Host "🔍 Vérification des prérequis..." -ForegroundColor Yellow
    
    # Vérifier Rust
    try {
        $rustVersion = rustc --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Rust installé: $rustVersion" -ForegroundColor Green
        } else {
            throw "Rust non trouvé"
        }
    } catch {
        Write-Host "  ❌ Rust non installé. Installez Rust depuis https://rustup.rs/" -ForegroundColor Red
        exit 1
    }

    # Vérifier Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Node.js installé: $nodeVersion" -ForegroundColor Green
        } else {
            throw "Node.js non trouvé"
        }
    } catch {
        Write-Host "  ❌ Node.js non installé. Installez Node.js depuis https://nodejs.org/" -ForegroundColor Red
        exit 1
    }

    # Vérifier PostgreSQL
    try {
        $pgVersion = psql --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ PostgreSQL installé: $pgVersion" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  PostgreSQL non trouvé. Assurez-vous qu'il est installé et accessible." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  PostgreSQL non trouvé. Assurez-vous qu'il est installé et accessible." -ForegroundColor Yellow
    }

    # Vérifier Redis
    try {
        $redisVersion = redis-server --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Redis installé: $redisVersion" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Redis non trouvé. Assurez-vous qu'il est installé et accessible." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  Redis non trouvé. Assurez-vous qu'il est installé et accessible." -ForegroundColor Yellow
    }

    Write-Host "  ✅ Vérification des prérequis terminée" -ForegroundColor Green
}

# Fonction pour configurer l'environnement
function Set-EnvironmentVariables {
    Write-Host "⚙️  Configuration des variables d'environnement..." -ForegroundColor Yellow
    
    foreach ($key in $envVars.Keys) {
        $value = $envVars[$key]
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
        Write-Host "  🔧 $key = $value" -ForegroundColor Cyan
    }
    
    Write-Host "  ✅ Variables d'environnement configurées" -ForegroundColor Green
}

# Fonction pour construire le backend optimisé
function Build-Backend {
    Write-Host "🔨 Construction du backend optimisé..." -ForegroundColor Yellow
    
    Push-Location "backend"
    
    try {
        # Nettoyer les builds précédents
        Write-Host "  🧹 Nettoyage des builds précédents..." -ForegroundColor Cyan
        cargo clean
        
        # Construire en mode release avec optimisations
        Write-Host "  🏗️  Construction en mode release..." -ForegroundColor Cyan
        $buildArgs = @("build", "--release")
        
        if ($Environment -eq "production") {
            $buildArgs += "--features", "production"
        }
        
        cargo $buildArgs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Backend construit avec succès" -ForegroundColor Green
        } else {
            throw "Erreur lors de la construction du backend"
        }
        
        # Copier l'exécutable
        $targetPath = "target/release/yukpo-backend"
        $deployPath = "../deploy/backend"
        
        if (!(Test-Path $deployPath)) {
            New-Item -ItemType Directory -Path $deployPath -Force | Out-Null
        }
        
        Copy-Item $targetPath $deployPath -Force
        Write-Host "  📦 Backend déployé dans $deployPath" -ForegroundColor Green
        
    } catch {
        Write-Host "  ❌ Erreur lors de la construction du backend: $_" -ForegroundColor Red
        exit 1
    } finally {
        Pop-Location
    }
}

# Fonction pour construire le frontend optimisé
function Build-Frontend {
    Write-Host "🎨 Construction du frontend optimisé..." -ForegroundColor Yellow
    
    Push-Location "frontend"
    
    try {
        # Installer les dépendances si nécessaire
        if (!(Test-Path "node_modules")) {
            Write-Host "  📦 Installation des dépendances..." -ForegroundColor Cyan
            npm install
        }
        
        # Construire en mode production avec optimisations
        Write-Host "  🏗️  Construction en mode production..." -ForegroundColor Cyan
        $buildArgs = @("run", "build")
        
        if ($Environment -eq "production") {
            $env:NODE_ENV = "production"
        }
        
        npm $buildArgs
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Frontend construit avec succès" -ForegroundColor Green
        } else {
            throw "Erreur lors de la construction du frontend"
        }
        
        # Copier les fichiers de build
        $buildPath = "dist"
        $deployPath = "../deploy/frontend"
        
        if (!(Test-Path $deployPath)) {
            New-Item -ItemType Directory -Path $deployPath -Force | Out-Null
        }
        
        Copy-Item "$buildPath/*" $deployPath -Recurse -Force
        Write-Host "  📦 Frontend déployé dans $deployPath" -ForegroundColor Green
        
    } catch {
        Write-Host "  ❌ Erreur lors de la construction du frontend: $_" -ForegroundColor Red
        exit 1
    } finally {
        Pop-Location
    }
}

# Fonction pour exécuter les tests de performance
function Test-Performance {
    if ($SkipTests) {
        Write-Host "⏭️  Tests de performance ignorés" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🧪 Exécution des tests de performance..." -ForegroundColor Yellow
    
    Push-Location "backend"
    
    try {
        # Exécuter les tests de performance
        Write-Host "  🔬 Lancement des tests..." -ForegroundColor Cyan
        cargo test performance_tests --release
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Tests de performance réussis" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Certains tests de performance ont échoué" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "  ❌ Erreur lors des tests de performance: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

# Fonction pour créer les fichiers de configuration
function New-ConfigurationFiles {
    Write-Host "📝 Création des fichiers de configuration..." -ForegroundColor Yellow
    
    $deployPath = "deploy"
    if (!(Test-Path $deployPath)) {
        New-Item -ItemType Directory -Path $deployPath -Force | Out-Null
    }
    
    # Configuration backend
    $backendConfig = @"
# Configuration d'optimisation Yukpo Backend
[server]
host = "0.0.0.0"
port = 8080
workers = 4

[database]
url = "postgresql://yukpo:password@localhost/yukpo"
pool_size = 10
max_connections = 20

[redis]
url = "redis://localhost:6379"
pool_size = 10

[cache]
default_ttl = 300
services_ttl = 600
users_ttl = 1800
exchanges_ttl = 300
max_entries = 10000

[matching]
min_score_threshold = 0.4
early_stop_threshold = 0.9
batch_size = 50
max_candidates = 1000
duplicate_protection_delay = 600

[api]
rate_limit_per_minute = 100
max_payload_size = 10485760
request_timeout = 30
enable_compression = true
enable_response_cache = true
response_cache_ttl = 300

[background]
cache_cleanup_interval = 300
service_deactivation_interval = 3600
score_update_interval = 1800
worker_count = 4
task_queue_size = 1000
"@
    
    $backendConfig | Out-File -FilePath "$deployPath/backend.toml" -Encoding UTF8
    Write-Host "  ✅ Configuration backend créée" -ForegroundColor Green
    
    # Configuration frontend
    $frontendConfig = @"
# Configuration d'optimisation Yukpo Frontend
{
  "api": {
    "baseUrl": "http://localhost:8080",
    "timeout": 30000,
    "retryAttempts": 3,
    "cacheEnabled": true,
    "cacheTTL": 300000
  },
  "performance": {
    "virtualization": {
      "enabled": true,
      "itemHeight": 120,
      "overscan": 5
    },
    "lazyLoading": {
      "enabled": true,
      "threshold": 0.1
    },
    "debounce": {
      "search": 300,
      "resize": 150
    }
  },
  "cache": {
    "maxSize": 100,
    "ttl": 300000
  }
}
"@
    
    $frontendConfig | Out-File -FilePath "$deployPath/frontend.json" -Encoding UTF8
    Write-Host "  ✅ Configuration frontend créée" -ForegroundColor Green
}

# Fonction pour créer le script de démarrage
function New-StartupScript {
    Write-Host "🚀 Création du script de démarrage..." -ForegroundColor Yellow
    
    $startupScript = @"
#!/bin/bash
# Script de démarrage optimisé pour Yukpo

set -e

echo "🚀 Démarrage de Yukpo avec optimisations..."

# Variables d'environnement pour les optimisations
export CACHE_DEFAULT_TTL=300
export CACHE_SERVICES_TTL=600
export CACHE_USERS_TTL=1800
export CACHE_EXCHANGES_TTL=300
export CACHE_MAX_ENTRIES=10000
export CACHE_MAX_MEMORY_SIZE=104857600

export DB_POOL_SIZE=10
export DB_CONNECT_TIMEOUT=30
export DB_ACQUIRE_TIMEOUT=30
export DB_IDLE_TIMEOUT=600
export DB_MAX_QUERY_SIZE=1048576
export DB_ENABLE_PREPARED_STATEMENTS=true
export DB_ENABLE_SLOW_QUERY_LOG=true
export DB_SLOW_QUERY_THRESHOLD=1000

export MATCHING_MIN_SCORE_THRESHOLD=0.4
export MATCHING_EARLY_STOP_THRESHOLD=0.9
export MATCHING_BATCH_SIZE=50
export MATCHING_MAX_CANDIDATES=1000
export MATCHING_DUPLICATE_PROTECTION_DELAY=600
export MATCHING_ENABLE_REPUTATION_CACHE=true
export MATCHING_REPUTATION_CACHE_TTL=3600

export API_RATE_LIMIT_PER_MINUTE=100
export API_MAX_PAYLOAD_SIZE=10485760
export API_REQUEST_TIMEOUT=30
export API_ENABLE_COMPRESSION=true
export API_ENABLE_RESPONSE_CACHE=true
export API_RESPONSE_CACHE_TTL=300

export BACKGROUND_CACHE_CLEANUP_INTERVAL=300
export BACKGROUND_SERVICE_DEACTIVATION_INTERVAL=3600
export BACKGROUND_SCORE_UPDATE_INTERVAL=1800
export BACKGROUND_WORKER_COUNT=4
export BACKGROUND_TASK_QUEUE_SIZE=1000

# Démarrer le backend
echo "🔧 Démarrage du backend..."
cd backend
./yukpo-backend --config ../backend.toml &

# Démarrer le frontend (si nécessaire)
echo "🎨 Démarrage du frontend..."
cd ../frontend
npx serve -s . -l 3000 &

echo "✅ Yukpo démarré avec succès!"
echo "📊 Backend: http://localhost:8080"
echo "🎨 Frontend: http://localhost:3000"

# Attendre les signaux d'arrêt
wait
"@
    
    $startupScript | Out-File -FilePath "deploy/start.sh" -Encoding UTF8
    Write-Host "  ✅ Script de démarrage créé" -ForegroundColor Green
}

# Fonction pour créer le Docker Compose optimisé
function New-DockerCompose {
    Write-Host "🐳 Création du Docker Compose optimisé..." -ForegroundColor Yellow
    
    $dockerCompose = @"
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: yukpo
      POSTGRES_USER: yukpo
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=100
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=4MB
      -c maintenance_work_mem=64MB

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 100mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.optimized
    environment:
      - DATABASE_URL=postgresql://yukpo:password@postgres:5432/yukpo
      - REDIS_URL=redis://redis:6379
      - CACHE_DEFAULT_TTL=300
      - CACHE_SERVICES_TTL=600
      - DB_POOL_SIZE=10
      - MATCHING_BATCH_SIZE=50
      - API_RATE_LIMIT_PER_MINUTE=100
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.optimized
    ports:
      - "3000:3000"
    depends_on:
      - backend
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M

volumes:
  postgres_data:
  redis_data:
"@
    
    $dockerCompose | Out-File -FilePath "deploy/docker-compose.yml" -Encoding UTF8
    Write-Host "  ✅ Docker Compose créé" -ForegroundColor Green
}

# Fonction principale
function Start-Deployment {
    Write-Host "🚀 Démarrage du déploiement optimisé..." -ForegroundColor Green
    
    # Vérifier les prérequis
    Test-Prerequisites
    
    # Configurer l'environnement
    Set-EnvironmentVariables
    
    # Construire le backend
    Build-Backend
    
    # Construire le frontend
    Build-Frontend
    
    # Exécuter les tests de performance
    Test-Performance
    
    # Créer les fichiers de configuration
    New-ConfigurationFiles
    
    # Créer le script de démarrage
    New-StartupScript
    
    # Créer le Docker Compose
    New-DockerCompose
    
    Write-Host "🎉 Déploiement optimisé terminé avec succès!" -ForegroundColor Green
    Write-Host "📁 Fichiers déployés dans le dossier 'deploy/'" -ForegroundColor Cyan
    Write-Host "🚀 Pour démarrer: cd deploy && ./start.sh" -ForegroundColor Cyan
    Write-Host "🐳 Ou avec Docker: cd deploy && docker-compose up -d" -ForegroundColor Cyan
}

# Exécution du script
Start-Deployment 