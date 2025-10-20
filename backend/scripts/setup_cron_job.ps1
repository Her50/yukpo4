# Script PowerShell pour configurer le rafraîchissement des pharmacies de garde
# Date: 2025-10-20

Write-Host "🔧 Configuration du rafraîchissement des pharmacies de garde" -ForegroundColor Green

# Vérifier si PostgreSQL est accessible
try {
    $psqlVersion = & psql --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "psql non trouvé"
    }
    Write-Host "✅ PostgreSQL détecté: $psqlVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ psql n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host "Veuillez installer PostgreSQL et ajouter psql au PATH" -ForegroundColor Yellow
    exit 1
}

# Variables de configuration
$DB_NAME = "yukpomnang"
$DB_USER = "postgres"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# Créer le script de rafraîchissement PowerShell
$refreshScript = @"
# Script de rafraîchissement des pharmacies de garde
# Exécuté toutes les heures

# Variables de base de données
`$DB_NAME = "$DB_NAME"
`$DB_USER = "$DB_USER"
`$DB_HOST = "$DB_HOST"
`$DB_PORT = "$DB_PORT"

# Log avec timestamp
`$LOG_FILE = "C:\logs\yukpomnang\pharmacies_refresh.log"
`$LOG_DIR = Split-Path `$LOG_FILE -Parent

if (!(Test-Path `$LOG_DIR)) {
    New-Item -ItemType Directory -Path `$LOG_DIR -Force
}

Add-Content -Path `$LOG_FILE -Value "`$(Get-Date): Début rafraîchissement pharmacies de garde"

# Exécuter le rafraîchissement
try {
    `$result = & psql -h `$DB_HOST -p `$DB_PORT -U `$DB_USER -d `$DB_NAME -c "SELECT refresh_pharmacies_on_duty();" 2>&1
    if (`$LASTEXITCODE -eq 0) {
        Add-Content -Path `$LOG_FILE -Value "`$(Get-Date): Rafraîchissement réussi"
    } else {
        Add-Content -Path `$LOG_FILE -Value "`$(Get-Date): Erreur lors du rafraîchissement: `$result"
        exit 1
    }
} catch {
    Add-Content -Path `$LOG_FILE -Value "`$(Get-Date): Exception lors du rafraîchissement: `$_"
    exit 1
}

Add-Content -Path `$LOG_FILE -Value "`$(Get-Date): Fin rafraîchissement pharmacies de garde"
"@

# Sauvegarder le script
$scriptPath = "C:\scripts\refresh_pharmacies.ps1"
$scriptDir = Split-Path $scriptPath -Parent

if (!(Test-Path $scriptDir)) {
    New-Item -ItemType Directory -Path $scriptDir -Force
}

$refreshScript | Out-File -FilePath $scriptPath -Encoding UTF8
Write-Host "✅ Script créé: $scriptPath" -ForegroundColor Green

# Créer une tâche planifiée Windows
$taskName = "Yukpomnang-RefreshPharmacies"
$taskDescription = "Rafraîchissement automatique des pharmacies de garde"

# Vérifier si la tâche existe déjà
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  La tâche planifiée existe déjà" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous la recréer? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "🗑️  Ancienne tâche supprimée" -ForegroundColor Yellow
    }
    else {
        Write-Host "ℹ️  Tâche existante conservée" -ForegroundColor Blue
        exit 0
    }
}

# Créer la tâche planifiée
try {
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $taskDescription

    Write-Host "✅ Tâche planifiée créée: $taskName" -ForegroundColor Green
}
catch {
    Write-Host "❌ Erreur lors de la création de la tâche: $_" -ForegroundColor Red
    exit 1
}

# Tester le script
Write-Host "🧪 Test du script de rafraîchissement..." -ForegroundColor Cyan
try {
    & PowerShell.exe -ExecutionPolicy Bypass -File $scriptPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Test réussi" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Test échoué" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur lors du test: $_" -ForegroundColor Red
    exit 1
}

# Afficher les informations
Write-Host ""
Write-Host "🎉 Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Informations:" -ForegroundColor Cyan
Write-Host "   - Script: $scriptPath" -ForegroundColor White
Write-Host "   - Logs: C:\logs\yukpomnang\pharmacies_refresh.log" -ForegroundColor White
Write-Host "   - Fréquence: Toutes les heures" -ForegroundColor White
Write-Host "   - Base de données: $DB_NAME@$DB_HOST`:$DB_PORT" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Pour vérifier les logs:" -ForegroundColor Cyan
Write-Host "   Get-Content C:\logs\yukpomnang\pharmacies_refresh.log -Tail 10 -Wait" -ForegroundColor White
Write-Host ""
Write-Host "🛠️  Pour gérer la tâche planifiée:" -ForegroundColor Cyan
Write-Host "   Get-ScheduledTask -TaskName $taskName" -ForegroundColor White
Write-Host "   Start-ScheduledTask -TaskName $taskName" -ForegroundColor White
Write-Host "   Stop-ScheduledTask -TaskName $taskName" -ForegroundColor White
