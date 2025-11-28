# Script pour démarrer LiveKit via le script Python existant
# Utilise scripts/ingress/bootstrap_ingress.py qui est déjà configuré
# Usage: .\scripts\start_livekit_via_python.ps1

$ErrorActionPreference = "Continue"

Write-Host "=== DEMARRAGE LIVEKIT VIA PYTHON ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = "ubuntu"
$LIVEKIT_SSH_HOST = "${SERVER_USER}@${SERVER_IP}"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Serveur: $LIVEKIT_SSH_HOST" -ForegroundColor White
Write-Host "  Script Python: scripts/ingress/bootstrap_ingress.py" -ForegroundColor White
Write-Host ""

# Aller dans le répertoire du projet
Set-Location "C:\Users\23767\yukpomnang2"
Write-Host "[OK] Repertoire: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 1. Vérifier Python
Write-Host "1. Verification de Python..." -ForegroundColor Yellow

try {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
    }
    
    if ($pythonCmd) {
        $pythonVersion = & $pythonCmd.Name --version 2>&1
        Write-Host "[OK] Python trouve: $pythonVersion" -ForegroundColor Green
        $PYTHON = $pythonCmd.Name
    } else {
        Write-Host "[ERREUR] Python non trouve" -ForegroundColor Red
        Write-Host "  Installez Python 3.8+ pour utiliser ce script" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Python non accessible: $_" -ForegroundColor Red
    exit 1
}

# 2. Vérifier que le script Python existe
Write-Host ""
Write-Host "2. Verification du script Python..." -ForegroundColor Yellow

$pythonScript = "scripts\ingress\bootstrap_ingress.py"
if (-not (Test-Path $pythonScript)) {
    Write-Host "[ERREUR] Script Python non trouve: $pythonScript" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Script trouve: $pythonScript" -ForegroundColor Green

# 3. Vérifier les dépendances Python
Write-Host ""
Write-Host "3. Verification des dependances Python..." -ForegroundColor Yellow

try {
    & $PYTHON -c "import yaml" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] PyYAML installe" -ForegroundColor Green
    } else {
        Write-Host "[ATTENTION] PyYAML non installe, installation..." -ForegroundColor Yellow
        & $PYTHON -m pip install pyyaml --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] PyYAML installe" -ForegroundColor Green
        } else {
            Write-Host "[ERREUR] Impossible d'installer PyYAML" -ForegroundColor Red
            exit 1
        }
    }
} catch {
    Write-Host "[ATTENTION] Erreur lors de la verification de PyYAML: $_" -ForegroundColor Yellow
}

# 4. Exécuter le script Python avec les variables d'environnement
Write-Host ""
Write-Host "4. Execution du script Python..." -ForegroundColor Yellow
Write-Host "  Le script va:" -ForegroundColor Gray
Write-Host "    - Se connecter au serveur via SSH" -ForegroundColor Gray
Write-Host "    - Configurer LiveKit avec Redis" -ForegroundColor Gray
Write-Host "    - Redemarrer le service LiveKit" -ForegroundColor Gray
Write-Host ""

# Configurer les variables d'environnement pour le script Python
$env:LIVEKIT_SSH_HOST = $LIVEKIT_SSH_HOST
$env:LIVEKIT_CONFIG_PATH = "/opt/livekit/livekit.yaml"

try {
    & $PYTHON $pythonScript
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Script Python execute avec succes!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] Le script Python s'est execute avec le code: $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "  Verifiez les messages ci-dessus pour plus de details" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur lors de l'execution du script Python: $_" -ForegroundColor Red
    exit 1
}

# 5. Vérification finale
Write-Host ""
Write-Host "5. Verification finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Configurer PATH pour SSH
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

try {
    $status = & ssh "$LIVEKIT_SSH_HOST" "systemctl status livekit --no-pager | head -n 10" 2>&1
    
    if ($status -match "active|running") {
        Write-Host "[OK] Service LiveKit est actif" -ForegroundColor Green
    } else {
        Write-Host "[ATTENTION] Statut du service:" -ForegroundColor Yellow
        Write-Host $status -ForegroundColor White
    }
} catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut du service" -ForegroundColor Yellow
}

# Test de connexion
Write-Host ""
Write-Host "6. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:7880/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:7880/" -ForegroundColor Cyan
    } else {
        Write-Host "[ATTENTION] Code HTTP: $httpCode" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] LiveKit n'est pas encore accessible depuis l'exterieur" -ForegroundColor Yellow
    Write-Host "  Cela peut prendre quelques secondes supplementaires" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== DEMARRAGE TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "LiveKit devrait etre accessible sur: http://${SERVER_IP}:7880/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  ssh $LIVEKIT_SSH_HOST" -ForegroundColor White
Write-Host "  sudo systemctl status livekit" -ForegroundColor White
Write-Host "  sudo systemctl restart livekit" -ForegroundColor White
Write-Host "  docker logs -f livekit-server" -ForegroundColor White
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green

