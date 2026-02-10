# Script Automatique Simple : Deploiement .env sur Hetzner

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploiement Automatique .env Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1: Generer le script bash si necessaire
if (-not (Test-Path "create-env-hetzner.sh")) {
    Write-Host "[1/4] Generation script bash..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\scripts\generate-hetzner-env.ps1 | Out-Null
}

if (-not (Test-Path "create-env-hetzner.sh")) {
    Write-Host "ERREUR: Impossible de generer create-env-hetzner.sh" -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Script bash OK" -ForegroundColor Green

# Etape 2: Verifier WSL
Write-Host "[2/4] Verification WSL..." -ForegroundColor Yellow
try {
    $wslCheck = wsl --list --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: WSL disponible" -ForegroundColor Green
    } else {
        throw "WSL non disponible"
    }
} catch {
    Write-Host "  ERREUR: WSL non disponible" -ForegroundColor Red
    Write-Host "  Installez WSL: wsl --install" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Alternative: Utilisez GitHub Actions:" -ForegroundColor Cyan
    Write-Host "  https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml" -ForegroundColor Cyan
    exit 1
}

# Etape 3: Configurer SSH dans WSL
Write-Host "[3/4] Configuration SSH dans WSL..." -ForegroundColor Yellow

$setupCmd = @'
mkdir -p ~/.ssh
chmod 700 ~/.ssh
if [ -f /mnt/c/Users/' + $env:USERNAME + '/.ssh/hetzner_deploy ]; then
  cp /mnt/c/Users/' + $env:USERNAME + '/.ssh/hetzner_deploy ~/.ssh/hetzner_deploy
  chmod 600 ~/.ssh/hetzner_deploy
  echo "SSH_KEY_OK"
else
  echo "SSH_KEY_MISSING"
fi
'@

$setupResult = wsl bash -c $setupCmd 2>&1

if ($setupResult -match "SSH_KEY_MISSING") {
    Write-Host "  ERREUR: Cle SSH non trouvee" -ForegroundColor Red
    Write-Host "  Executez: .\scripts\setup-wsl-ssh.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "  OK: Cle SSH configuree" -ForegroundColor Green

# Etape 4: Deployer via WSL
Write-Host "[4/4] Deploiement sur Hetzner..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre 30-60 secondes)" -ForegroundColor Gray

# Lire le contenu et le passer directement a WSL (evite les problemes de chemin et retours a la ligne)
Write-Host "  Copie du script..." -ForegroundColor Cyan
$scriptContent = Get-Content "create-env-hetzner.sh" -Raw
# Convertir les retours a la ligne Windows en Unix
$scriptContent = $scriptContent -replace "`r`n", "`n" -replace "`r", "`n"

# Passer le contenu a WSL via stdin
$copyResult = $scriptContent | wsl bash -c "cat > /tmp/create-env-hetzner.sh && chmod +x /tmp/create-env-hetzner.sh && echo 'COPY_OK'" 2>&1

if ($copyResult -match "COPY_OK") {
    Write-Host "  OK: Script copie dans WSL" -ForegroundColor Green
    
    Write-Host "  Envoi sur Hetzner..." -ForegroundColor Cyan
    $scpResult = wsl bash -c "scp -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 /tmp/create-env-hetzner.sh root@46.224.14.85:/tmp/" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: Script envoye sur Hetzner" -ForegroundColor Green
        
        Write-Host "  Execution sur Hetzner..." -ForegroundColor Cyan
        $execResult = wsl bash -c "ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@46.224.14.85 'bash /tmp/create-env-hetzner.sh'" 2>&1
        
        if ($LASTEXITCODE -eq 0 -or $execResult -match "Fichier .env cree") {
            $deployResult = "DEPLOY_SUCCESS"
        } else {
            $deployResult = "DEPLOY_FAILED"
        }
    } else {
        Write-Host "  ERREUR: Echec de la copie" -ForegroundColor Red
        $deployResult = "DEPLOY_FAILED"
    }
} else {
    Write-Host "  ERREUR: Echec de la copie dans WSL" -ForegroundColor Red
    $deployResult = "DEPLOY_FAILED"
}

if ($deployResult -match "DEPLOY_SUCCESS" -or $deployResult -match "Fichier .env cree") {
    Write-Host "  OK: Deploiement reussi!" -ForegroundColor Green
    
    # Verification
    Write-Host ""
    Write-Host "Verification..." -ForegroundColor Cyan
    $verify = wsl bash -c "ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no root@46.224.14.85 'ls -lh /opt/yukpo/.env && wc -l /opt/yukpo/.env'" 2>&1
    Write-Host $verify
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  TERMINE AVEC SUCCES!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le fichier .env est maintenant sur Hetzner:" -ForegroundColor Cyan
    Write-Host "  /opt/yukpo/.env" -ForegroundColor Gray
} else {
    Write-Host "  ERREUR: Echec du deploiement" -ForegroundColor Red
    Write-Host $deployResult
    Write-Host ""
    Write-Host "Alternative: Utilisez GitHub Actions:" -ForegroundColor Yellow
    Write-Host "  https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml" -ForegroundColor Cyan
}

