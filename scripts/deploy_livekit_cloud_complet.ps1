# Script complet pour déployer LiveKit sur le serveur cloud
# Installe OpenSSH si nécessaire et déploie automatiquement
# Usage: .\scripts\deploy_livekit_cloud_complet.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== DEPLOIEMENT COMPLET LIVEKIT CLOUD ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$SERVER_IP = "46.224.14.85"
$SERVER_USER = Read-Host "Nom d'utilisateur SSH pour $SERVER_IP (ex: root, ubuntu, admin)"
$LIVEKIT_PORT = "7880"

# Vérifier/Installer OpenSSH
Write-Host "1. Verification/Installation OpenSSH..." -ForegroundColor Yellow

$sshInstalled = $false
try {
    $sshVersion = ssh -V 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] SSH deja installe: $sshVersion" -ForegroundColor Green
        $sshInstalled = $true
    }
} catch {
    Write-Host "[INFO] SSH non trouve, installation..." -ForegroundColor Yellow
}

if (-not $sshInstalled) {
    # Vérifier les droits administrateur
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Host "[ERREUR] Ce script necessite des droits administrateur pour installer OpenSSH" -ForegroundColor Red
        Write-Host ""
        Write-Host "SOLUTION:" -ForegroundColor Yellow
        Write-Host "1. Clic droit sur PowerShell" -ForegroundColor Cyan
        Write-Host "2. Selectionner 'Executer en tant qu'administrateur'" -ForegroundColor Cyan
        Write-Host "3. Relancer ce script" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "OU utilisez le script simplifie:" -ForegroundColor Yellow
        Write-Host "  .\scripts\deploy_livekit_cloud_simple.ps1" -ForegroundColor Cyan
        exit 1
    }
    
    Write-Host "  Installation OpenSSH Client..." -ForegroundColor Gray
    try {
        Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0 -ErrorAction Stop
        Write-Host "[OK] OpenSSH installe" -ForegroundColor Green
        
        # Redémarrer la session pour que SSH soit dans le PATH
        Write-Host "[ATTENTION] Vous devrez peut-etre redemarrer PowerShell pour que SSH soit accessible" -ForegroundColor Yellow
        Write-Host "  Fermez et rouvrez PowerShell, puis relancez ce script" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "OU continuez avec les commandes manuelles ci-dessous" -ForegroundColor Yellow
    } catch {
        Write-Host "[ERREUR] Impossible d'installer OpenSSH: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "ALTERNATIVE: Utilisez le script simplifie:" -ForegroundColor Yellow
        Write-Host "  .\scripts\deploy_livekit_cloud_simple.ps1" -ForegroundColor Cyan
        exit 1
    }
}

# Vérifier SSH maintenant (essayer plusieurs chemins)
Write-Host ""
Write-Host "2. Verification SSH..." -ForegroundColor Yellow

$sshPaths = @(
    "ssh",
    "$env:ProgramFiles\OpenSSH-Win64\ssh.exe",
    "$env:ProgramFiles\OpenSSH\ssh.exe",
    "${env:ProgramFiles(x86)}\OpenSSH-Win64\ssh.exe",
    "${env:ProgramFiles(x86)}\OpenSSH\ssh.exe"
)

$sshCmd = $null
foreach ($sshPath in $sshPaths) {
    try {
        if ($sshPath -eq "ssh") {
            $result = ssh -V 2>&1
        } else {
            if (Test-Path $sshPath) {
                $result = & $sshPath -V 2>&1
            } else {
                continue
            }
        }
        if ($LASTEXITCODE -eq 0) {
            $sshCmd = $sshPath
            Write-Host "[OK] SSH trouve: $sshPath" -ForegroundColor Green
            Write-Host "  Version: $result" -ForegroundColor Gray
            break
        }
    } catch {
        continue
    }
}

if (-not $sshCmd) {
    Write-Host "[ERREUR] SSH n'est toujours pas accessible" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTIONS:" -ForegroundColor Yellow
    Write-Host "1. Redemarrer PowerShell et relancer ce script" -ForegroundColor Cyan
    Write-Host "2. OU utiliser le script simplifie:" -ForegroundColor Cyan
    Write-Host "   .\scripts\deploy_livekit_cloud_simple.ps1" -ForegroundColor White
    Write-Host "3. OU installer WinSCP et utiliser la methode manuelle" -ForegroundColor Cyan
    exit 1
}

# Fonction pour exécuter SSH
function Invoke-SSHCommand {
    param([string]$Command)
    if ($sshCmd -eq "ssh") {
        Invoke-Expression $Command
    } else {
        $Command = $Command -replace "ssh ", "$sshCmd "
        Invoke-Expression $Command
    }
}

# Transférer et exécuter le script
Write-Host ""
Write-Host "3. Transfert du script vers le serveur..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$deployScript = Join-Path $scriptDir "deploy_livekit_cloud.sh"
$remoteScriptPath = "/tmp/deploy_livekit_cloud.sh"

if (-not (Test-Path $deployScript)) {
    Write-Host "[ERREUR] Script de deploiement non trouve: $deployScript" -ForegroundColor Red
    exit 1
}

Write-Host "  Script local: $deployScript" -ForegroundColor Gray
Write-Host "  Destination: ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}" -ForegroundColor Gray
Write-Host "  (Vous devrez peut-etre entrer le mot de passe SSH)" -ForegroundColor Gray
Write-Host ""

# Trouver SCP aussi
$scpPaths = @(
    "scp",
    "$env:ProgramFiles\OpenSSH-Win64\scp.exe",
    "$env:ProgramFiles\OpenSSH\scp.exe",
    "${env:ProgramFiles(x86)}\OpenSSH-Win64\scp.exe",
    "${env:ProgramFiles(x86)}\OpenSSH\scp.exe"
)

$scpCmd = $null
foreach ($scpPath in $scpPaths) {
    if ($scpPath -eq "scp") {
        $scpCmd = "scp"
        break
    } elseif (Test-Path $scpPath) {
        $scpCmd = $scpPath
        break
    }
}

try {
    if ($scpCmd -eq "scp") {
        $scpCommand = "scp `"$deployScript`" ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}"
    } else {
        $scpCommand = "& `"$scpCmd`" `"$deployScript`" ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}"
    }
    Invoke-Expression $scpCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Script transfere" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Erreur lors du transfert" -ForegroundColor Red
        Write-Host "  Verifiez vos credentials SSH" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERREUR] Erreur SCP: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "ALTERNATIVE: Transferez manuellement:" -ForegroundColor Yellow
    Write-Host "  scp $deployScript ${SERVER_USER}@${SERVER_IP}:${remoteScriptPath}" -ForegroundColor Cyan
    exit 1
}

# Exécuter le script sur le serveur
Write-Host ""
Write-Host "4. Execution du script sur le serveur..." -ForegroundColor Yellow
Write-Host "  (Cela peut prendre 2-3 minutes)" -ForegroundColor Gray
Write-Host ""

if ($sshCmd -eq "ssh") {
    $sshCommand = "ssh ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteScriptPath && $remoteScriptPath'"
} else {
    $sshCommand = "& `"$sshCmd`" ${SERVER_USER}@${SERVER_IP} 'chmod +x $remoteScriptPath && $remoteScriptPath'"
}

try {
    Invoke-Expression $sshCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Deploiement termine!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ATTENTION] Le script s'est execute mais il y a peut-etre des erreurs" -ForegroundColor Yellow
        Write-Host "  Verifiez les logs ci-dessus" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur SSH: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "ALTERNATIVE: Connectez-vous manuellement:" -ForegroundColor Yellow
    Write-Host "  ssh ${SERVER_USER}@${SERVER_IP}" -ForegroundColor Cyan
    Write-Host "  Puis executez: chmod +x $remoteScriptPath && $remoteScriptPath" -ForegroundColor Cyan
    exit 1
}

# Vérification finale
Write-Host ""
Write-Host "5. Verification finale..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    if ($sshCmd -eq "ssh") {
        $testCommand = "ssh ${SERVER_USER}@${SERVER_IP} 'docker ps --filter name=livekit-server --format `"{{.Status}}`"'"
    } else {
        $testCommand = "& `"$sshCmd`" ${SERVER_USER}@${SERVER_IP} 'docker ps --filter name=livekit-server --format `"{{.Status}}`"'"
    }
    $status = Invoke-Expression $testCommand 2>&1
    
    if ($status -match "Up") {
        Write-Host "[OK] LiveKit est en cours d'execution sur le serveur" -ForegroundColor Green
    } else {
        Write-Host "[ATTENTION] Statut LiveKit: $status" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] Impossible de verifier le statut" -ForegroundColor Yellow
}

# Test de connexion
Write-Host ""
Write-Host "6. Test de connexion depuis l'exterieur..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://${SERVER_IP}:${LIVEKIT_PORT}/" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    $httpCode = $response.StatusCode
    if ($httpCode -eq 200 -or $httpCode -eq 404 -or $httpCode -eq 405) {
        Write-Host "[OK] LiveKit est accessible depuis l'exterieur!" -ForegroundColor Green
        Write-Host "  URL: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
    } else {
        Write-Host "[ATTENTION] LiveKit repond avec le code: $httpCode" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ATTENTION] LiveKit n'est pas encore accessible (peut prendre quelques minutes)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DEPLOIEMENT TERMINE ===" -ForegroundColor Green
Write-Host ""
Write-Host "LiveKit devrait etre accessible sur: http://${SERVER_IP}:${LIVEKIT_PORT}/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Le backend Render se connectera automatiquement lors du prochain demarrage." -ForegroundColor Green

