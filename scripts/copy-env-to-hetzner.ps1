# Copie automatique du script .env sur Hetzner

$ErrorActionPreference = "Continue"
$HetznerHost = "46.224.14.85"
$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"

Write-Host "Copie Script sur Hetzner" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path "create-env-hetzner.sh")) {
    Write-Host "ERREUR: create-env-hetzner.sh introuvable" -ForegroundColor Red
    Write-Host "Executez d'abord: .\scripts\generate-hetzner-env.ps1" -ForegroundColor Yellow
    exit 1
}

# Methode 1: Utiliser plink (si disponible) ou ssh direct avec timeout
Write-Host "[1/2] Copie du script..." -ForegroundColor Yellow

# Creer un job avec timeout
$copyJob = Start-Job -ScriptBlock {
    param($hetznerHost, $key, $file)
    $content = Get-Content $file -Raw
    $base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))
    
    # Copier via SSH en une commande
    $cmd = "echo '$base64' | base64 -d > /tmp/create-env-hetzner.sh && chmod +x /tmp/create-env-hetzner.sh && echo OK"
    ssh -i $key -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 -o ServerAliveInterval=2 -o ServerAliveCountMax=3 "root@$hetznerHost" $cmd 2>&1
} -ArgumentList $HetznerHost, $sshKeyPath, "create-env-hetzner.sh"

# Attendre avec timeout
$result = $copyJob | Wait-Job -Timeout 15

if ($result) {
    $output = $copyJob | Receive-Job
    Remove-Job $copyJob
    
    if ($output -match "OK") {
        Write-Host "  OK: Script copie sur Hetzner" -ForegroundColor Green
        
        # Executer le script
        Write-Host "[2/2] Execution du script..." -ForegroundColor Yellow
        $execJob = Start-Job -ScriptBlock {
            param($hetznerHost, $key)
            ssh -i $key -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@$hetznerHost" "bash /tmp/create-env-hetzner.sh" 2>&1
        } -ArgumentList $HetznerHost, $sshKeyPath
        
        $execResult = $execJob | Wait-Job -Timeout 20
        if ($execResult) {
            $execOutput = $execJob | Receive-Job
            Remove-Job $execJob
            Write-Host $execOutput
            Write-Host "  OK: Fichier .env cree sur Hetzner" -ForegroundColor Green
        } else {
            Stop-Job $execJob
            Remove-Job $execJob
            Write-Host "  TIMEOUT: Executez manuellement: bash /tmp/create-env-hetzner.sh" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ERREUR: $output" -ForegroundColor Red
        Write-Host "  Copiez manuellement create-env-hetzner.sh sur Hetzner" -ForegroundColor Yellow
    }
} else {
    Stop-Job $copyJob
    Remove-Job $copyJob
    Write-Host "  TIMEOUT: Copie manuelle necessaire" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Copiez manuellement:" -ForegroundColor Cyan
    Write-Host "  scp create-env-hetzner.sh root@${HetznerHost}:/tmp/" -ForegroundColor White
    Write-Host "  ssh root@${HetznerHost} 'bash /tmp/create-env-hetzner.sh'" -ForegroundColor White
}

Write-Host ""
Write-Host "=================" -ForegroundColor Green
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green

