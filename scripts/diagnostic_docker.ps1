# Script de diagnostic Docker Desktop
# Usage: .\scripts\diagnostic_docker.ps1

Write-Host "=== DIAGNOSTIC DOCKER DESKTOP ===" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier si Docker Desktop est installé
Write-Host "1. Verification de l'installation Docker Desktop..." -ForegroundColor Yellow

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
        Write-Host "[OK] Docker Desktop trouve: $dockerPath" -ForegroundColor Green
        break
    }
}

if (-not $dockerPath) {
    Write-Host "[ERREUR] Docker Desktop n'est pas installe" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Telechargez Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host "2. Installez Docker Desktop" -ForegroundColor Cyan
    Write-Host "3. Redemarrez votre ordinateur si demande" -ForegroundColor Cyan
    exit 1
}

# 2. Vérifier si Docker Desktop est en cours d'exécution
Write-Host ""
Write-Host "2. Verification des processus Docker..." -ForegroundColor Yellow

$dockerProcesses = @(
    "Docker Desktop",
    "com.docker.backend",
    "dockerd",
    "docker"
)

$running = $false
foreach ($procName in $dockerProcesses) {
    $proc = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "[OK] Processus trouve: $procName (PID: $($proc.Id))" -ForegroundColor Green
        $running = $true
    }
}

if (-not $running) {
    Write-Host "[ATTENTION] Docker Desktop ne semble pas etre en cours d'execution" -ForegroundColor Yellow
}

# 3. Vérifier WSL2 (requis pour Docker Desktop)
Write-Host ""
Write-Host "3. Verification de WSL2..." -ForegroundColor Yellow

try {
    $wslVersion = wsl --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] WSL est installe" -ForegroundColor Green
        $wslVersion | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    } else {
        Write-Host "[ATTENTION] WSL peut ne pas etre installe correctement" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERREUR] WSL n'est pas accessible" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Ouvrez PowerShell en tant qu'administrateur" -ForegroundColor Cyan
    Write-Host "2. Executez: wsl --install" -ForegroundColor Cyan
    Write-Host "3. Redemarrez votre ordinateur" -ForegroundColor Cyan
}

# 4. Vérifier les services Windows
Write-Host ""
Write-Host "4. Verification des services Windows Docker..." -ForegroundColor Yellow

$services = @(
    "com.docker.service",
    "docker"
)

foreach ($serviceName in $services) {
    try {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Write-Host "[OK] Service trouve: $serviceName (Status: $($service.Status))" -ForegroundColor Green
            if ($service.Status -ne "Running") {
                Write-Host "  [ATTENTION] Le service n'est pas en cours d'execution" -ForegroundColor Yellow
            }
        }
    } catch {
        # Service non trouvé, c'est normal
    }
}

# 5. Vérifier les permissions
Write-Host ""
Write-Host "5. Verification des permissions..." -ForegroundColor Yellow

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Host "[OK] PowerShell execute en tant qu'administrateur" -ForegroundColor Green
} else {
    Write-Host "[ATTENTION] PowerShell n'est PAS execute en tant qu'administrateur" -ForegroundColor Yellow
    Write-Host "  Certaines operations peuvent necessiter des droits administrateur" -ForegroundColor Gray
}

# 6. Vérifier l'accès à docker.exe
Write-Host ""
Write-Host "6. Verification de l'acces a docker.exe..." -ForegroundColor Yellow

try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] docker.exe est accessible: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] docker.exe n'est pas accessible" -ForegroundColor Red
        Write-Host "  Erreur: $dockerVersion" -ForegroundColor Gray
    }
} catch {
    Write-Host "[ERREUR] docker.exe n'est pas dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION:" -ForegroundColor Yellow
    Write-Host "1. Redemarrez Docker Desktop" -ForegroundColor Cyan
    Write-Host "2. Ouvrez un NOUVEAU PowerShell (le PATH est mis a jour)" -ForegroundColor Cyan
    Write-Host "3. Verifiez que Docker Desktop est completement demarre" -ForegroundColor Cyan
}

# 7. Tentative de démarrage de Docker Desktop
Write-Host ""
Write-Host "7. Tentative de demarrage de Docker Desktop..." -ForegroundColor Yellow

if (-not $running) {
    try {
        Write-Host "Demarrage de Docker Desktop..." -ForegroundColor Gray
        Start-Process -FilePath $dockerPath -ErrorAction Stop
        Write-Host "[OK] Commande de demarrage envoyee" -ForegroundColor Green
        Write-Host ""
        Write-Host "Attendez 30-60 secondes que Docker Desktop demarre..." -ForegroundColor Yellow
        Write-Host "Verifiez l'icone Docker dans la barre des taches" -ForegroundColor Yellow
    } catch {
        Write-Host "[ERREUR] Impossible de demarrer Docker Desktop: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "SOLUTIONS ALTERNATIVES:" -ForegroundColor Yellow
        Write-Host "1. Demarrez Docker Desktop manuellement depuis le menu Demarrer" -ForegroundColor Cyan
        Write-Host "2. Clic droit sur Docker Desktop > Executer en tant qu'administrateur" -ForegroundColor Cyan
        Write-Host "3. Redemarrez votre ordinateur" -ForegroundColor Cyan
    }
} else {
    Write-Host "[OK] Docker Desktop semble deja etre en cours d'execution" -ForegroundColor Green
}

# 8. Vérifier les ports utilisés
Write-Host ""
Write-Host "8. Verification des ports Docker..." -ForegroundColor Yellow

$dockerPorts = @(2375, 2376, 2377)
foreach ($port in $dockerPorts) {
    $portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "[OK] Port $port est utilise (normal pour Docker)" -ForegroundColor Green
    }
}

# 9. Résumé et recommandations
Write-Host ""
Write-Host "=== RESUMÉ ===" -ForegroundColor Cyan
Write-Host ""

if ($dockerPath -and $running) {
    Write-Host "[OK] Docker Desktop est installe et semble etre en cours d'execution" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROCHAINES ETAPES:" -ForegroundColor Yellow
    Write-Host "1. Attendez que l'icone Docker dans la barre des taches soit stable" -ForegroundColor Cyan
    Write-Host "2. Ouvrez un NOUVEAU PowerShell" -ForegroundColor Cyan
    Write-Host "3. Executez: docker --version" -ForegroundColor Cyan
    Write-Host "4. Si OK, executez: .\scripts\verifier_docker_et_demarrer.ps1" -ForegroundColor Cyan
} elseif ($dockerPath -and -not $running) {
    Write-Host "[ATTENTION] Docker Desktop est installe mais n'est pas en cours d'execution" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "SOLUTIONS:" -ForegroundColor Yellow
    Write-Host "1. Demarrez Docker Desktop manuellement depuis le menu Demarrer" -ForegroundColor Cyan
    Write-Host "2. Attendez 30-60 secondes" -ForegroundColor Cyan
    Write-Host "3. Verifiez l'icone Docker dans la barre des taches" -ForegroundColor Cyan
    Write-Host "4. Si probleme persiste, redemarrez votre ordinateur" -ForegroundColor Cyan
} else {
    Write-Host "[ERREUR] Docker Desktop n'est pas installe" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTALLATION:" -ForegroundColor Yellow
    Write-Host "1. Telechargez: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host "2. Installez Docker Desktop" -ForegroundColor Cyan
    Write-Host "3. Redemarrez votre ordinateur" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Pour plus d'aide, consultez: scripts/GUIDE_DEMARRAGE_DOCKER.md" -ForegroundColor Gray

