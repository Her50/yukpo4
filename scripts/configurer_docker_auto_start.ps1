# Script pour configurer Docker Desktop pour démarrer automatiquement
# Usage: .\scripts\configurer_docker_auto_start.ps1

Write-Host "=== CONFIGURATION DOCKER AUTO-START ===" -ForegroundColor Cyan
Write-Host ""

# Vérifier si Docker Desktop est installé
$dockerPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (-not (Test-Path $dockerPath)) {
    Write-Host "[ERREUR] Docker Desktop non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration de Docker Desktop pour demarrer automatiquement..." -ForegroundColor Yellow
Write-Host ""

# Méthode 1 : Tâche planifiée Windows
Write-Host "1. Creation d'une tache planifiee Windows..." -ForegroundColor Yellow

$taskName = "Docker Desktop Auto Start"
$taskDescription = "Demarre Docker Desktop automatiquement au demarrage de Windows"

try {
    # Supprimer la tâche existante si elle existe
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "  [INFO] Tache existante supprimee" -ForegroundColor Gray
    }
    
    # Créer la nouvelle tâche
    $action = New-ScheduledTaskAction -Execute $dockerPath
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    
    Write-Host "[OK] Tache planifiee creee: $taskName" -ForegroundColor Green
    Write-Host "  Docker Desktop demarrera automatiquement a la connexion Windows" -ForegroundColor Gray
}
catch {
    Write-Host "[ATTENTION] Impossible de creer la tache planifiee: $_" -ForegroundColor Yellow
    Write-Host "  Vous pouvez configurer manuellement dans Docker Desktop" -ForegroundColor Cyan
}

# Méthode 2 : Configuration dans Docker Desktop
Write-Host ""
Write-Host "2. Configuration dans Docker Desktop..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour activer le demarrage automatique dans Docker Desktop:" -ForegroundColor Cyan
Write-Host "1. Ouvrez Docker Desktop" -ForegroundColor White
Write-Host "2. Allez dans Settings (Parametres)" -ForegroundColor White
Write-Host "3. Allez dans General" -ForegroundColor White
Write-Host "4. Cochez 'Start Docker Desktop when you log in'" -ForegroundColor White
Write-Host "5. Cliquez sur 'Apply & Restart'" -ForegroundColor White
Write-Host ""

# Méthode 3 : Dossier de démarrage Windows
Write-Host "3. Ajout au dossier de demarrage Windows..." -ForegroundColor Yellow

$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$shortcutPath = Join-Path $startupFolder "Docker Desktop.lnk"

try {
    if (-not (Test-Path $shortcutPath)) {
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = $dockerPath
        $Shortcut.WorkingDirectory = Split-Path $dockerPath
        $Shortcut.Save()
        
        Write-Host "[OK] Raccourci ajoute au dossier de demarrage" -ForegroundColor Green
    }
    else {
        Write-Host "[INFO] Raccourci existe deja dans le dossier de demarrage" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ATTENTION] Impossible de creer le raccourci: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== CONFIGURATION TERMINEE ===" -ForegroundColor Green
Write-Host ""
Write-Host "Docker Desktop demarrera automatiquement:" -ForegroundColor Cyan
Write-Host "  - Au demarrage de Windows (tache planifiee)" -ForegroundColor White
Write-Host "  - A la connexion utilisateur (dossier de demarrage)" -ForegroundColor White
Write-Host ""
Write-Host "Pour verifier:" -ForegroundColor Yellow
Write-Host "  1. Redemarrez votre ordinateur" -ForegroundColor Cyan
Write-Host "  2. Docker Desktop devrait demarrer automatiquement" -ForegroundColor Cyan
Write-Host "  3. Verifiez l'icone Docker dans la barre des taches" -ForegroundColor Cyan

