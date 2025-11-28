# Script pour démarrer Docker Desktop sur Windows
# Usage: .\scripts\start_docker.ps1

Write-Host "Demarrage de Docker Desktop..." -ForegroundColor Green

# Vérifier si Docker Desktop est déjà en cours d'exécution
$dockerProcess = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerProcess) {
    Write-Host "[OK] Docker Desktop est deja en cours d'execution" -ForegroundColor Green
    Write-Host "Verification de Docker..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    try {
        $dockerVersion = docker --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Docker est accessible: $dockerVersion" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        Write-Host "[ATTENTION] Docker Desktop est demarre mais Docker n'est pas encore accessible" -ForegroundColor Yellow
        Write-Host "Attendez quelques secondes que Docker se termine de demarrer..." -ForegroundColor Yellow
    }
    exit 0
}

# Chemins possibles pour Docker Desktop
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
    Write-Host "[ERREUR] Docker Desktop n'est pas trouve dans les emplacements standards" -ForegroundColor Red
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "1. Installer Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host "2. Demarrer Docker Desktop manuellement depuis le menu Demarrer" -ForegroundColor Cyan
    Write-Host "3. Verifier que Docker Desktop est installe dans un emplacement personnalise" -ForegroundColor Cyan
    exit 1
}

# Démarrer Docker Desktop
Write-Host "Demarrage de Docker Desktop..." -ForegroundColor Yellow
try {
    Start-Process -FilePath $dockerPath -ErrorAction Stop
    Write-Host "[OK] Docker Desktop est en cours de demarrage..." -ForegroundColor Green
    Write-Host ""
    Write-Host "Attente que Docker soit pret (cela peut prendre 30-60 secondes)..." -ForegroundColor Yellow
    
    # Attendre que Docker soit accessible
    $maxAttempts = 30
    $attempt = 0
    $dockerReady = $false
    
    while ($attempt -lt $maxAttempts -and -not $dockerReady) {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            $dockerVersion = docker --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dockerReady = $true
                Write-Host "[OK] Docker est maintenant accessible: $dockerVersion" -ForegroundColor Green
                break
            }
        }
        catch {
            # Continuer à attendre
        }
        
        if ($attempt % 5 -eq 0) {
            Write-Host "   Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
        }
    }
    
    if (-not $dockerReady) {
        Write-Host "[ATTENTION] Docker n'est pas encore accessible apres $maxAttempts tentatives" -ForegroundColor Yellow
        Write-Host "   Docker Desktop peut prendre plus de temps pour demarrer" -ForegroundColor Yellow
        Write-Host "   Verifiez l'icone Docker dans la barre des taches" -ForegroundColor Yellow
        Write-Host "   Vous pouvez executer 'docker --version' manuellement pour verifier" -ForegroundColor Yellow
    }
    
}
catch {
    Write-Host "[ERREUR] Impossible de demarrer Docker Desktop: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Essayez de demarrer Docker Desktop manuellement:" -ForegroundColor Yellow
    Write-Host "1. Ouvrez le menu Demarrer" -ForegroundColor Cyan
    Write-Host "2. Recherchez 'Docker Desktop'" -ForegroundColor Cyan
    Write-Host "3. Cliquez sur 'Docker Desktop'" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "[OK] Docker Desktop devrait etre pret maintenant!" -ForegroundColor Green
Write-Host "Vous pouvez maintenant executer: .\scripts\restart_livekit.ps1" -ForegroundColor Cyan

