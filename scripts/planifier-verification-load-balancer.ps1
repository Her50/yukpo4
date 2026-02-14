# Script pour planifier la vérification automatique du Load Balancer
# Date: 2026-02-14
# Objectif: Vérifier périodiquement si le Load Balancer est activé et configurer automatiquement

param(
    [int]$IntervalHours = 1
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PLANIFICATION VERIFICATION LOAD BALANCER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$DetectionScript = Join-Path $ScriptDir "detecter-et-configurer-load-balancer-auto.ps1"

Write-Host "[INFO] Configuration de la tache planifiee..." -ForegroundColor Yellow
Write-Host "  Script: $DetectionScript" -ForegroundColor Gray
Write-Host "  Intervalle: $IntervalHours heure(s)" -ForegroundColor Gray
Write-Host ""

# Vérifier si la tâche existe déjà
$taskName = "Yukpo-LoadBalancer-AutoDetect"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "[ATTENTION] Tache existante trouvee: $taskName" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous la remplacer? (O/N)"
    if ($response -ne "O" -and $response -ne "o" -and $response -ne "Y" -and $response -ne "y") {
        Write-Host "[INFO] Operation annulee" -ForegroundColor Yellow
        exit 0
    }
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[OK] Ancienne tache supprimee" -ForegroundColor Green
}

# Créer l'action (exécuter le script PowerShell)
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$DetectionScript`"" `
    -WorkingDirectory $ProjectRoot

# Créer le déclencheur (toutes les X heures)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours $IntervalHours) -RepetitionDuration (New-TimeSpan -Days 365)

# Créer les paramètres
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Créer le principal (utilisateur actuel)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

# Enregistrer la tâche
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Verification automatique si Load Balancer AWS est active et configuration DNS automatique" | Out-Null
    
    Write-Host "[OK] Tache planifiee creee avec succes!" -ForegroundColor Green
    Write-Host "  Nom: $taskName" -ForegroundColor Gray
    Write-Host "  Intervalle: $IntervalHours heure(s)" -ForegroundColor Gray
    Write-Host "  Prochaine execution: $(Get-ScheduledTask -TaskName $taskName).NextRunTime" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[INFO] La tache verifiera automatiquement toutes les $IntervalHours heure(s)" -ForegroundColor Cyan
    Write-Host "[INFO] Si le Load Balancer est detecte, la configuration sera automatique" -ForegroundColor Cyan
    Write-Host "[INFO] Pour desactiver: Unregister-ScheduledTask -TaskName $taskName" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[ERREUR] Impossible de creer la tache: $_" -ForegroundColor Red
    Write-Host "[INFO] Essayez d'executer PowerShell en tant qu'administrateur" -ForegroundColor Yellow
    exit 1
}

# Tester immédiatement
Write-Host "[INFO] Test de la detection..." -ForegroundColor Yellow
& $DetectionScript
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Systeme 100% automatique configure!" -ForegroundColor Green
Write-Host "[INFO] Quand AWS activera le Load Balancer, tout sera configure automatiquement" -ForegroundColor Cyan
Write-Host ""

