# Script pour reproduire les commandes de la session précédente
# Usage: .\scripts\deploy_livekit_cloud_manual.ps1
# Ce script reproduit exactement les commandes utilisées dans la session précédente

$ErrorActionPreference = "Continue"

Write-Host "=== REPRODUCTION SESSION PRECEDENTE ===" -ForegroundColor Cyan
Write-Host ""

# Aller dans le répertoire du projet
Set-Location "C:\Users\23767\yukpomnang2"
Write-Host "[OK] Repertoire: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# 1. Chercher SSH dans les emplacements courants
Write-Host "1. Recherche SSH dans les emplacements courants..." -ForegroundColor Yellow
$sshPaths = @(
    "$env:ProgramFiles\OpenSSH-Win64\ssh.exe",
    "$env:ProgramFiles\OpenSSH\ssh.exe",
    "${env:ProgramFiles(x86)}\OpenSSH-Win64\ssh.exe"
)

$sshFound = $false
foreach ($path in $sshPaths) {
    if (Test-Path $path) {
        Write-Host "[OK] SSH trouve: $path" -ForegroundColor Green
        $sshFound = $true
        break
    } else {
        Write-Host "[INFO] Non trouve: $path" -ForegroundColor Gray
    }
}

# 2. Chercher SSH via Get-Command
Write-Host ""
Write-Host "2. Recherche SSH via Get-Command..." -ForegroundColor Yellow
try {
    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if ($sshCmd) {
        Write-Host "[OK] SSH trouve: $($sshCmd.Source)" -ForegroundColor Green
        $sshFound = $true
    } else {
        Write-Host "[INFO] SSH non trouve via Get-Command" -ForegroundColor Gray
    }
} catch {
    Write-Host "[INFO] SSH non trouve via Get-Command" -ForegroundColor Gray
}

# 3. Configurer PATH et vérifier SSH
Write-Host ""
Write-Host "3. Configuration PATH et verification SSH..." -ForegroundColor Yellow
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

try {
    $sshCmd = Get-Command ssh -ErrorAction SilentlyContinue
    if ($sshCmd) {
        Write-Host "[OK] SSH trouve via PATH: $($sshCmd.Source)" -ForegroundColor Green
        $sshFound = $true
    }
} catch {
    Write-Host "[INFO] SSH non trouve via PATH" -ForegroundColor Gray
}

# 4. Vérifier la version SSH
Write-Host ""
Write-Host "4. Verification version SSH..." -ForegroundColor Yellow
try {
    $sshVersion = ssh -V 2>&1
    Write-Host "[OK] Version SSH: $sshVersion" -ForegroundColor Green
    $sshFound = $true
} catch {
    Write-Host "[ERREUR] Impossible d'executer ssh -V" -ForegroundColor Red
}

if (-not $sshFound) {
    Write-Host ""
    Write-Host "[ERREUR] SSH n'est pas accessible" -ForegroundColor Red
    Write-Host "  Installez OpenSSH pour Windows" -ForegroundColor Yellow
    exit 1
}

# 5. Demander les identifiants et déployer
Write-Host ""
Write-Host "5. Deploiement LiveKit..." -ForegroundColor Yellow
Write-Host ""

$SERVER_USER = Read-Host "Nom d'utilisateur SSH (ex: root, ubuntu)"
$SERVER_IP = "46.224.14.85"

Write-Host ""
Write-Host "Transfert du script..." -ForegroundColor Yellow

# Transférer le script
$deployScript = "scripts\deploy_livekit_cloud.sh"
$remoteScriptPath = "/tmp/deploy_livekit_cloud.sh"

try {
    & scp $deployScript "${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Script transfere" -ForegroundColor Green
        Write-Host ""
        Write-Host "Execution sur le serveur..." -ForegroundColor Yellow
        
        # Exécuter le script sur le serveur
        & ssh "${SERVER_USER}@${SERVER_IP}" "chmod +x $remoteScriptPath && $remoteScriptPath"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[OK] Deploiement termine!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "[ATTENTION] Le script s'est execute avec le code: $LASTEXITCODE" -ForegroundColor Yellow
            Write-Host "  Verifiez les logs ci-dessus" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[ERREUR] Echec du transfert (code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  Verifiez vos identifiants SSH et la connexion au serveur" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERREUR] Erreur lors du deploiement: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Commandes manuelles:" -ForegroundColor Yellow
    Write-Host "  scp $deployScript ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}" -ForegroundColor Cyan
    Write-Host "  ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteScriptPath && $remoteScriptPath'" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== FIN ===" -ForegroundColor Green

