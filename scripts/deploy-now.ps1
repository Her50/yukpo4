# Deploiement immediat .env sur Hetzner

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOIEMENT IMMEDIAT .env HETZNER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1: Generer le script bash
Write-Host "[1/3] Generation script bash..." -ForegroundColor Yellow
if (-not (Test-Path "create-env-hetzner.sh")) {
    powershell -ExecutionPolicy Bypass -File .\scripts\generate-hetzner-env.ps1 | Out-Null
}
if (Test-Path "create-env-hetzner.sh") {
    Write-Host "  OK: Script bash genere" -ForegroundColor Green
} else {
    Write-Host "  ERREUR: Impossible de generer le script" -ForegroundColor Red
    exit 1
}

# Etape 2: Preparer WSL
Write-Host "[2/3] Preparation WSL..." -ForegroundColor Yellow

# Configurer SSH dans WSL
$setupWsl = @'
mkdir -p ~/.ssh
chmod 700 ~/.ssh
if [ -f /mnt/c/Users/' + $env:USERNAME + '/.ssh/hetzner_deploy ]; then
  cp /mnt/c/Users/' + $env:USERNAME + '/.ssh/hetzner_deploy ~/.ssh/hetzner_deploy
  chmod 600 ~/.ssh/hetzner_deploy
  ssh-keygen -f ~/.ssh/known_hosts -R 46.224.14.85 2>/dev/null
  ssh-keyscan -H 46.224.14.85 >> ~/.ssh/known_hosts 2>/dev/null
  echo "WSL_READY"
else
  echo "SSH_KEY_MISSING"
fi
'@

$wslResult = wsl bash -c $setupWsl 2>&1

if ($wslResult -match "SSH_KEY_MISSING") {
    Write-Host "  ERREUR: Cle SSH non trouvee" -ForegroundColor Red
    exit 1
}

Write-Host "  OK: WSL prepare" -ForegroundColor Green

# Etape 3: Deployer
Write-Host "[3/3] Deploiement sur Hetzner..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre 30-60 secondes)" -ForegroundColor Gray

# Lire le script et le passer a WSL
$scriptContent = Get-Content "create-env-hetzner.sh" -Raw
$scriptContent = $scriptContent -replace "`r`n", "`n" -replace "`r", "`n"

# Creer le script dans WSL
$scriptContent | wsl bash -c "cat > /tmp/create-env-hetzner.sh && chmod +x /tmp/create-env-hetzner.sh && echo 'SCRIPT_READY'" | Out-Null

# Copier sur Hetzner
Write-Host "  Copie sur Hetzner..." -ForegroundColor Cyan
$scpResult = wsl bash -c "scp -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 /tmp/create-env-hetzner.sh root@46.224.14.85:/tmp/" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: Script copie" -ForegroundColor Green
    
    # Executer sur Hetzner
    Write-Host "  Execution sur Hetzner..." -ForegroundColor Cyan
    $execResult = wsl bash -c "ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@46.224.14.85 'bash /tmp/create-env-hetzner.sh'" 2>&1
    
    if ($LASTEXITCODE -eq 0 -or $execResult -match "Fichier .env cree") {
        Write-Host "  OK: Script execute" -ForegroundColor Green
        
        # Verification
        Write-Host ""
        Write-Host "Verification..." -ForegroundColor Cyan
        $verify = wsl bash -c "ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no root@46.224.14.85 'ls -lh /opt/yukpo/.env 2>/dev/null && wc -l /opt/yukpo/.env 2>/dev/null || echo FICHIER_NON_TROUVE'" 2>&1
        Write-Host $verify
        
        if ($verify -notmatch "FICHIER_NON_TROUVE") {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  SUCCES! Fichier .env deploye!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Le fichier .env est maintenant sur Hetzner:" -ForegroundColor Cyan
            Write-Host "  /opt/yukpo/.env" -ForegroundColor Gray
            exit 0
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Deploiement echoue" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Alternative: Utilisez GitHub Actions:" -ForegroundColor Cyan
Write-Host "  https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml" -ForegroundColor Gray
Write-Host "  Cliquez sur 'Run workflow'" -ForegroundColor Gray

