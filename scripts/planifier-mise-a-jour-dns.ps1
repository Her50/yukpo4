# Script pour planifier la mise à jour automatique DNS Cloudflare
# Date: 2026-02-14
# Objectif: Créer une tâche planifiée Windows pour exécuter le script de mise à jour DNS

param(
    [int]$IntervalMinutes = 15
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PLANIFICATION MISE A JOUR DNS AUTO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$UpdateScript = Join-Path $ScriptDir "mettre-a-jour-dns-cloudflare-auto.ps1"

Write-Host "[INFO] Configuration de la tache planifiee..." -ForegroundColor Yellow
Write-Host "  Script: $UpdateScript" -ForegroundColor Gray
Write-Host "  Intervalle: $IntervalMinutes minutes" -ForegroundColor Gray
Write-Host ""

# Vérifier si la tâche existe déjà
$taskName = "Yukpo-DNS-Cloudflare-AutoUpdate"
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
    -Argument "-ExecutionPolicy Bypass -File `"$UpdateScript`"" `
    -WorkingDirectory $ProjectRoot

# Créer le déclencheur (toutes les X minutes)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 365)

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
        -Description "Mise a jour automatique DNS Cloudflare pour api.yukpomnang.com quand l'IP ECS change" | Out-Null
    
    Write-Host "[OK] Tache planifiee creee avec succes!" -ForegroundColor Green
    Write-Host "  Nom: $taskName" -ForegroundColor Gray
    Write-Host "  Intervalle: $IntervalMinutes minutes" -ForegroundColor Gray
    Write-Host "  Prochaine execution: $(Get-ScheduledTask -TaskName $taskName).NextRunTime" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[INFO] La tache s'executera automatiquement toutes les $IntervalMinutes minutes" -ForegroundColor Cyan
    Write-Host "[INFO] Pour desactiver: Unregister-ScheduledTask -TaskName $taskName" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[ERREUR] Impossible de creer la tache: $_" -ForegroundColor Red
    Write-Host "[INFO] Essayez d'executer PowerShell en tant qu'administrateur" -ForegroundColor Yellow
    exit 1
}

# Tester immédiatement
Write-Host "[INFO] Test de la mise a jour DNS..." -ForegroundColor Yellow
& $UpdateScript
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

