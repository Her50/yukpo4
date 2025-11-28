# Script pour forcer le démarrage de Docker Desktop
# Usage: .\scripts\forcer_demarrage_docker.ps1
# Nécessite des droits administrateur

Write-Host "=== FORCAGE DU DEMARRAGE DOCKER ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier les droits administrateur
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERREUR] Ce script necessite des droits administrateur" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Clic droit sur PowerShell" -ForegroundColor Cyan
    Write-Host "2. Selectionner 'Executer en tant qu'administrateur'" -ForegroundColor Cyan
    Write-Host "3. Relancer ce script" -ForegroundColor Cyan
    exit 1
}

Write-Host "[OK] PowerShell execute en tant qu'administrateur" -ForegroundColor Green
Write-Host ""

# 1. Arrêter tous les processus Docker existants
Write-Host "1. Arret des processus Docker existants..." -ForegroundColor Yellow

$dockerProcesses = @(
    "Docker Desktop",
    "com.docker.backend",
    "dockerd",
    "docker"
)

foreach ($procName in $dockerProcesses) {
    $processes = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($processes) {
        foreach ($proc in $processes) {
            Write-Host "  Arret de $procName (PID: $($proc.Id))..." -ForegroundColor Gray
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Start-Sleep -Seconds 1
            }
            catch {
                Write-Host "  [ATTENTION] Impossible d'arreter $procName" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "[OK] Processus arretes" -ForegroundColor Green
Start-Sleep -Seconds 2

# 2. Arrêter les services Docker
Write-Host ""
Write-Host "2. Arret des services Docker..." -ForegroundColor Yellow

$services = @(
    "com.docker.service",
    "docker"
)

foreach ($serviceName in $services) {
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -eq "Running") {
                Write-Host "  Arret du service: $serviceName..." -ForegroundColor Gray
                Stop-Service -Name $serviceName -Force -ErrorAction Stop
            }
            else {
                Write-Host "  Service $serviceName deja arrete" -ForegroundColor Gray
            }
        }
    }
    catch {
        Write-Host "  [ATTENTION] Service $serviceName non trouve ou erreur" -ForegroundColor Yellow
    }
}

Write-Host "[OK] Services arretes" -ForegroundColor Green
Start-Sleep -Seconds 2

# 3. Démarrer les services Docker
Write-Host ""
Write-Host "3. Demarrage des services Docker..." -ForegroundColor Yellow

foreach ($serviceName in $services) {
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "  Demarrage du service: $serviceName..." -ForegroundColor Gray
            Start-Service -Name $serviceName -ErrorAction Stop
            Start-Sleep -Seconds 2
            
            # Vérifier le statut
            $service.Refresh()
            if ($service.Status -eq "Running") {
                Write-Host "  [OK] Service $serviceName demarre" -ForegroundColor Green
            }
            else {
                Write-Host "  [ATTENTION] Service $serviceName n'est pas en cours d'execution" -ForegroundColor Yellow
            }
        }
    }
    catch {
        Write-Host "  [ATTENTION] Impossible de demarrer $serviceName" -ForegroundColor Yellow
    }
}

# 4. Trouver et démarrer Docker Desktop
Write-Host ""
Write-Host "4. Demarrage de Docker Desktop..." -ForegroundColor Yellow

$dockerPaths = @(
    "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe",
    "$env:USERPROFILE\AppData\Local\Programs\Docker\Docker\Docker Desktop.exe"
)

$dockerPath = $null
foreach ($path in $dockerPaths) {
    if (Test-Path $path) {
        $dockerPath = $path
        break
    }
}

if ($dockerPath) {
    Write-Host "  Chemin trouve: $dockerPath" -ForegroundColor Gray
    
    try {
        Write-Host "  Demarrage de Docker Desktop..." -ForegroundColor Gray
        Start-Process -FilePath $dockerPath -ErrorAction Stop
        Write-Host "[OK] Commande de demarrage envoyee" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERREUR] Impossible de demarrer Docker Desktop: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "[ERREUR] Docker Desktop non trouve" -ForegroundColor Red
    exit 1
}

# 5. Attendre que Docker soit prêt
Write-Host ""
Write-Host "5. Attente que Docker soit pret (cela peut prendre 30-60 secondes)..." -ForegroundColor Yellow
Write-Host ""

$maxWait = 90 # 90 secondes maximum
$waited = 0
$dockerReady = $false

while ($waited -lt $maxWait -and -not $dockerReady) {
    Start-Sleep -Seconds 2
    $waited += 2
    
    # Vérifier si docker.exe est accessible
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $dockerReady = $true
            Write-Host "[OK] Docker est maintenant accessible!" -ForegroundColor Green
            Write-Host "  Version: $dockerVersion" -ForegroundColor Gray
            break
        }
    }
    catch {
        # Continuer à attendre
    }
    
    # Afficher le progrès
    if ($waited % 10 -eq 0) {
        $percent = [math]::Round(($waited / $maxWait) * 100)
        Write-Host "  Attente... $waited/$maxWait secondes ($percent%)" -ForegroundColor Gray
        
        # Vérifier les processus
        $proc = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  [INFO] Docker Desktop est en cours d'execution (PID: $($proc.Id))" -ForegroundColor Cyan
        }
    }
}

if (-not $dockerReady) {
    Write-Host ""
    Write-Host "[ATTENTION] Docker n'est pas encore accessible apres $maxWait secondes" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "VERIFICATIONS:" -ForegroundColor Yellow
    Write-Host "1. Verifiez l'icone Docker dans la barre des taches" -ForegroundColor Cyan
    Write-Host "2. L'icone doit etre stable (pas de spinner)" -ForegroundColor Cyan
    Write-Host "3. Ouvrez un NOUVEAU PowerShell et executez: docker --version" -ForegroundColor Cyan
    Write-Host "4. Si toujours inaccessible, redemarrez votre ordinateur" -ForegroundColor Cyan
}
else {
    Write-Host ""
    Write-Host "=== DEMARRAGE REUSSI ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Docker est maintenant pret!" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
    Write-Host "1. Ouvrez un NOUVEAU PowerShell (important pour le PATH)" -ForegroundColor Cyan
    Write-Host "2. Executez: docker --version" -ForegroundColor Cyan
    Write-Host "3. Executez: .\scripts\verifier_docker_et_demarrer.ps1" -ForegroundColor Cyan
    Write-Host ""
    
    # Test rapide
    Write-Host "Test rapide..." -ForegroundColor Yellow
    try {
        $containers = docker ps -a 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] docker ps fonctionne" -ForegroundColor Green
            if ($containers) {
                Write-Host "Conteneurs trouves:" -ForegroundColor Cyan
                $containers | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
            }
            else {
                Write-Host "[INFO] Aucun conteneur pour le moment" -ForegroundColor Gray
            }
        }
    }
    catch {
        Write-Host "[ATTENTION] docker ps ne fonctionne pas encore" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Script termine." -ForegroundColor Gray

