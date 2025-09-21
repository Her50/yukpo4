#!/usr/bin/env pwsh
# Script de test du déploiement Docker

Write-Host "=== Test du déploiement Docker Yukpomnang ===" -ForegroundColor Cyan

# Vérifier si Docker est installé
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker installé: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker n'est pas installé ou accessible" -ForegroundColor Red
    exit 1
}

# Vérifier si Docker Desktop est en cours d'exécution
Write-Host "`nVérification de Docker Desktop..." -ForegroundColor Yellow
try {
    $dockerStatus = docker ps 2>$null
    Write-Host "✓ Docker Desktop est en cours d'exécution" -ForegroundColor Green
} catch {
    Write-Host "⚠ Docker Desktop n'est pas démarré" -ForegroundColor Yellow
    Write-Host "Tentative de démarrage de Docker Desktop..." -ForegroundColor Yellow
    
    # Essayer de démarrer Docker Desktop
    $dockerDesktopPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktopPath) {
        Start-Process $dockerDesktopPath
        Write-Host "Docker Desktop en cours de démarrage..." -ForegroundColor Yellow
        Write-Host "Attendez quelques secondes puis relancez ce script." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "✗ Docker Desktop non trouvé. Veuillez l'installer." -ForegroundColor Red
        exit 1
    }
}

# Vérifier les fichiers nécessaires
Write-Host "`nVérification des fichiers de configuration..." -ForegroundColor Yellow

$requiredFiles = @(
    "docker-compose.yml",
    "backend/Dockerfile",
    "frontend/Dockerfile",
    "nginx/nginx.conf"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file manquant" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "Des fichiers nécessaires sont manquants." -ForegroundColor Red
    exit 1
}

# Nettoyer les conteneurs existants
Write-Host "`nNettoyage des conteneurs existants..." -ForegroundColor Yellow
docker-compose down --remove-orphans 2>$null

# Construire et démarrer les services
Write-Host "`nConstruction et démarrage des services..." -ForegroundColor Yellow
try {
    # Démarrer PostgreSQL en premier
    Write-Host "Démarrage de PostgreSQL..." -ForegroundColor Cyan
    docker-compose up -d postgres
    
    # Attendre que PostgreSQL soit prêt
    Write-Host "Attente de PostgreSQL..." -ForegroundColor Cyan
    Start-Sleep -Seconds 30
    
    # Démarrer le backend
    Write-Host "Démarrage du backend..." -ForegroundColor Cyan
    docker-compose up --build -d backend
    
    # Attendre que le backend soit prêt
    Write-Host "Attente du backend..." -ForegroundColor Cyan
    Start-Sleep -Seconds 20
    
    # Démarrer le frontend
    Write-Host "Démarrage du frontend..." -ForegroundColor Cyan
    docker-compose up --build -d frontend
    
    # Démarrer Nginx
    Write-Host "Démarrage de Nginx..." -ForegroundColor Cyan
    docker-compose up -d nginx
    
    Write-Host "✓ Tous les services sont démarrés" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur lors du démarrage: $_" -ForegroundColor Red
    exit 1
}

# Vérifier le statut des services
Write-Host "`nStatut des services:" -ForegroundColor Yellow
docker-compose ps

# Tester les endpoints
Write-Host "`nTest des endpoints..." -ForegroundColor Yellow

# Test PostgreSQL
try {
    $pgStatus = docker-compose exec -T postgres pg_isready -U postgres
    if ($pgStatus -match "accepting connections") {
        Write-Host "✓ PostgreSQL: Opérationnel" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ PostgreSQL: Problème de connexion" -ForegroundColor Yellow
}

# Test Backend (via Docker)
try {
    Start-Sleep -Seconds 5
    $backendStatus = docker-compose exec -T backend curl -s http://localhost:3001/healthz
    if ($backendStatus -eq "OK") {
        Write-Host "✓ Backend: Opérationnel" -ForegroundColor Green
    } else {
        Write-Host "⚠ Backend: $backendStatus" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Backend: Problème de connexion" -ForegroundColor Yellow
}

# Test via Nginx
Write-Host "`nTest via Nginx (http://localhost)..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 5
    $nginxResponse = Invoke-WebRequest -Uri "http://localhost" -TimeoutSec 10
    if ($nginxResponse.StatusCode -eq 200) {
        Write-Host "✓ Nginx + Frontend: Opérationnel" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Nginx: $_" -ForegroundColor Yellow
}

Write-Host "`n=== Résumé ===" -ForegroundColor Cyan
Write-Host "URLs disponibles:" -ForegroundColor White
Write-Host "  - Application complète: http://localhost" -ForegroundColor Green
Write-Host "  - Frontend direct: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  - Backend direct: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor Cyan

Write-Host "`nCommandes utiles:" -ForegroundColor White
Write-Host "  - Voir les logs: docker-compose logs -f" -ForegroundColor Gray
Write-Host "  - Arrêter: docker-compose down" -ForegroundColor Gray
Write-Host "  - Redémarrer: docker-compose restart" -ForegroundColor Gray 