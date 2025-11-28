# Script de vérification finale Docker
# À exécuter dans un NOUVEAU PowerShell après le démarrage de Docker

Write-Host "=== VERIFICATION FINALE DOCKER ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier docker.exe
Write-Host "1. Verification de docker.exe..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Docker est accessible!" -ForegroundColor Green
        Write-Host "  Version: $dockerVersion" -ForegroundColor Gray
    }
    else {
        Write-Host "[ERREUR] docker.exe n'est pas accessible" -ForegroundColor Red
        Write-Host "  Erreur: $dockerVersion" -ForegroundColor Gray
        Write-Host ""
        Write-Host "SOLUTION:" -ForegroundColor Yellow
        Write-Host "1. Verifiez que Docker Desktop est completement demarre" -ForegroundColor Cyan
        Write-Host "2. L'icone Docker dans la barre des taches doit etre stable" -ForegroundColor Cyan
        Write-Host "3. Attendez encore 30 secondes et reessayez" -ForegroundColor Cyan
        Write-Host "4. Si probleme persiste, redemarrez votre ordinateur" -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "[ERREUR] docker.exe n'est pas dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Fermez ce PowerShell" -ForegroundColor Cyan
    Write-Host "2. Ouvrez un NOUVEAU PowerShell" -ForegroundColor Cyan
    Write-Host "3. Relancez ce script" -ForegroundColor Cyan
    exit 1
}

# Vérifier les conteneurs
Write-Host ""
Write-Host "2. Verification des conteneurs..." -ForegroundColor Yellow
try {
    $containers = docker ps -a 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] docker ps fonctionne" -ForegroundColor Green
        if ($containers -and $containers.Count -gt 0) {
            Write-Host "Conteneurs trouves:" -ForegroundColor Cyan
            $containers | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
        }
        else {
            Write-Host "[INFO] Aucun conteneur pour le moment" -ForegroundColor Gray
        }
    }
}
catch {
    Write-Host "[ATTENTION] docker ps ne fonctionne pas" -ForegroundColor Yellow
}

# Vérifier docker-compose
Write-Host ""
Write-Host "3. Verification de docker-compose..." -ForegroundColor Yellow
try {
    docker compose version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] docker compose est disponible" -ForegroundColor Green
    }
    else {
        docker-compose version 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] docker-compose est disponible" -ForegroundColor Green
        }
        else {
            Write-Host "[ATTENTION] docker-compose n'est pas disponible" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "[ATTENTION] docker-compose n'est pas disponible" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DOCKER EST PRET! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez maintenant:" -ForegroundColor Yellow
Write-Host "1. Demarrer les services: docker-compose up -d" -ForegroundColor Cyan
Write-Host "2. OU utiliser le script: .\scripts\verifier_docker_et_demarrer.ps1" -ForegroundColor Cyan
Write-Host "3. OU demarrer LiveKit: .\scripts\restart_livekit.ps1" -ForegroundColor Cyan

