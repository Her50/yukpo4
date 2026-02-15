# Script pour désactiver COMPLÈTEMENT toutes les automatisations Cloudflare
# Date: 2026-02-15
# Objectif: Arrêter toutes les tâches planifiées et automatisations Cloudflare

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DESACTIVATION AUTOMATISATIONS CLOUDFLARE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Etape 1: Rechercher et désactiver les tâches planifiées Windows
Write-Host "[ETAPE 1/4] Recherche des tâches planifiées Windows..." -ForegroundColor Yellow

$tasks = Get-ScheduledTask | Where-Object {
    $_.TaskName -like "*cloudflare*" -or
    $_.TaskName -like "*dns*" -or
    $_.TaskName -like "*yukpo*" -or
    ($_.Actions.Execute -like "*cloudflare*") -or
    ($_.Actions.Arguments -like "*cloudflare*") -or
    ($_.Actions.Arguments -like "*mettre-a-jour-dns*") -or
    ($_.Actions.Arguments -like "*detecter-et-configurer-load-balancer*")
}

if ($tasks) {
    Write-Host "   [ATTENTION] Tâches planifiées trouvées:" -ForegroundColor Yellow
    foreach ($task in $tasks) {
        Write-Host "      - $($task.TaskName) (Etat: $($task.State))" -ForegroundColor White
        
        # Désactiver la tâche
        try {
            Disable-ScheduledTask -TaskName $task.TaskName -ErrorAction SilentlyContinue
            Write-Host "         [OK] Tâche désactivée" -ForegroundColor Green
        } catch {
            Write-Host "         [ERREUR] Impossible de désactiver: $_" -ForegroundColor Red
        }
        
        # Supprimer la tâche (optionnel, commenté pour sécurité)
        # Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "   [OK] Aucune tâche planifiée trouvée" -ForegroundColor Green
}

Write-Host ""

# Etape 2: Vérifier les scripts Cloudflare et les désactiver complètement
Write-Host "[ETAPE 2/4] Désactivation des scripts Cloudflare..." -ForegroundColor Yellow

$scripts = @(
    "scripts\mettre-a-jour-dns-cloudflare-auto.ps1",
    "scripts\configurer-dns-cloudflare-automatique.ps1",
    "scripts\detecter-et-configurer-load-balancer-auto.ps1"
)

foreach ($script in $scripts) {
    if (Test-Path $script) {
        Write-Host "   [INFO] Vérification: $script" -ForegroundColor Cyan
        
        $content = Get-Content $script -Raw
        
        # Vérifier si le script est déjà désactivé
        if ($content -match "exit 0|DÉSACTIVÉ|désactivé|SCRIPT DÉSACTIVÉ") {
            Write-Host "      [OK] Script déjà désactivé" -ForegroundColor Green
        } else {
            Write-Host "      [ATTENTION] Script actif - Ajout de désactivation..." -ForegroundColor Yellow
            
            # Ajouter exit 0 au début du script
            $newContent = @"
# ⚠️ SCRIPT DÉSACTIVÉ - Migration vers GCP Cloud Run
# Date: 2026-02-15
# Ce script est désactivé car l'application a migré vers GCP Cloud Run
Write-Host "Script désactivé - Migration vers GCP Cloud Run" -ForegroundColor Yellow
exit 0

"@
            $newContent += $content
            Set-Content -Path $script -Value $newContent -Encoding UTF8
            Write-Host "      [OK] Script désactivé" -ForegroundColor Green
        }
    }
}

Write-Host ""

# Etape 3: Vérifier les workflows GitHub Actions
Write-Host "[ETAPE 3/4] Vérification des workflows GitHub Actions..." -ForegroundColor Yellow

$workflows = Get-ChildItem -Path ".github\workflows" -Filter "*.yml" -ErrorAction SilentlyContinue

if ($workflows) {
    foreach ($workflow in $workflows) {
        $content = Get-Content $workflow.FullName -Raw -ErrorAction SilentlyContinue
        
        if ($content -match "cloudflare|Cloudflare|CLOUDFLARE") {
            Write-Host "   [ATTENTION] Workflow avec Cloudflare trouvé: $($workflow.Name)" -ForegroundColor Yellow
            Write-Host "      [INFO] Vérifiez manuellement ce workflow" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "   [OK] Aucun workflow GitHub Actions trouvé" -ForegroundColor Green
}

Write-Host ""

# Etape 4: Vérifier les processus PowerShell en cours
Write-Host "[ETAPE 4/4] Vérification des processus PowerShell..." -ForegroundColor Yellow

$processes = Get-Process -Name "powershell*" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*cloudflare*" -or
    $_.CommandLine -like "*mettre-a-jour-dns*" -or
    $_.CommandLine -like "*detecter-et-configurer-load-balancer*"
}

if ($processes) {
    Write-Host "   [ATTENTION] Processus PowerShell avec Cloudflare trouvés:" -ForegroundColor Yellow
    foreach ($proc in $processes) {
        Write-Host "      - PID: $($proc.Id) - $($proc.ProcessName)" -ForegroundColor White
        Write-Host "      [INFO] Arrêt du processus..." -ForegroundColor Cyan
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "      [OK] Processus arrêté" -ForegroundColor Green
    }
} else {
    Write-Host "   [OK] Aucun processus PowerShell Cloudflare en cours" -ForegroundColor Green
}

Write-Host ""
Write-Host "[OK] Désactivation terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "Résumé:" -ForegroundColor Cyan
Write-Host "   Tâches planifiées: Vérifiées et désactivées" -ForegroundColor White
Write-Host "   Scripts Cloudflare: Désactivés" -ForegroundColor White
Write-Host "   Workflows GitHub: Vérifiés" -ForegroundColor White
Write-Host "   Processus PowerShell: Vérifiés" -ForegroundColor White
Write-Host ""
Write-Host "Si PowerShell s'ouvre encore, vérifiez:" -ForegroundColor Yellow
Write-Host "   1. Les tâches planifiées Windows (Task Scheduler)" -ForegroundColor White
Write-Host "   2. Les workflows GitHub Actions" -ForegroundColor White
Write-Host "   3. Les scripts de démarrage Windows" -ForegroundColor White
Write-Host ""

