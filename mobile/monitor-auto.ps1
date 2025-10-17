# Monitoring automatique des logs Metro avec détection d'erreurs

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MONITORING AUTOMATIQUE ACTIF" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$logFile = "monitoring-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"
$errorLogFile = "erreurs-detectees-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"
$startTime = Get-Date
$checkInterval = 5  # Secondes entre chaque vérification

# Compteurs
$totalChecks = 0
$errorsDetected = 0
$warningsDetected = 0
$successfulBuilds = 0
$failedBuilds = 0

# Patterns d'erreurs à détecter
$errorPatterns = @(
    "ERROR",
    "Error:",
    "Failed to",
    "Cannot",
    "Unable to",
    "ENOENT",
    "ECONNREFUSED",
    "Module not found",
    "Syntax error",
    "Unexpected token",
    "is not defined",
    "Cannot read property",
    "TypeError",
    "ReferenceError",
    "SyntaxError",
    "crashed",
    "fatal error"
)

$warningPatterns = @(
    "WARNING",
    "Warning:",
    "WARN",
    "deprecated",
    "should be updated",
    "may not work"
)

$successPatterns = @(
    "Successfully",
    "Bundled successfully",
    "Metro waiting",
    "Build finished"
)

function Write-Log {
    param($Message, $Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Write-Host $logEntry -ForegroundColor $Color
    Add-Content -Path $logFile -Value $logEntry
}

function Check-MetroProcess {
    $metroProc = Get-Process -Name "node" -ErrorAction SilentlyContinue
    return $metroProc
}

function Analyze-MetroOutput {
    # Simuler la lecture des logs Metro (dans un cas réel, on lirait les logs du processus)
    $metroProc = Check-MetroProcess
    
    if (-not $metroProc) {
        return @{
            Status = "ERROR"
            Message = "Metro Bundler n'est pas actif"
            Severity = "Critical"
        }
    }
    
    # Vérifier la connexion web
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8081" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            return @{
                Status = "SUCCESS"
                Message = "Metro actif et accessible"
                Severity = "Info"
            }
        }
    } catch {
        return @{
            Status = "ERROR"
            Message = "Metro actif mais interface web inaccessible: $($_.Exception.Message)"
            Severity = "Warning"
        }
    }
}

function Check-CriticalFiles {
    $criticalFiles = @(
        "App.tsx",
        "package.json",
        "src\contexts\AuthContext.tsx",
        "src\navigation\AppNavigator.tsx",
        "src\components\ErrorBoundary.tsx",
        "src\utils\jwtDecode.ts"
    )
    
    $missingFiles = @()
    foreach ($file in $criticalFiles) {
        if (-not (Test-Path $file)) {
            $missingFiles += $file
        }
    }
    
    return $missingFiles
}

function Check-NodeModules {
    $criticalModules = @(
        "node_modules\react",
        "node_modules\react-native",
        "node_modules\expo",
        "node_modules\react-native-web"
    )
    
    $missingModules = @()
    foreach ($module in $criticalModules) {
        if (-not (Test-Path $module)) {
            $missingModules += $module
        }
    }
    
    return $missingModules
}

# Démarrage du monitoring
Write-Log "Démarrage du monitoring automatique..." "Green"
Write-Log "Fichier de log: $logFile" "Cyan"
Write-Log "Fichier erreurs: $errorLogFile" "Cyan"
Write-Log "Intervalle de vérification: $checkInterval secondes" "Cyan"
Write-Host ""

# Vérifications initiales
Write-Host "[INIT] Vérifications initiales..." -ForegroundColor Yellow
Write-Host ""

# 1. Vérifier le répertoire
$currentDir = Get-Location
Write-Host "  Répertoire: $currentDir" -ForegroundColor Gray
if ($currentDir.Path -notlike "*\mobile") {
    Write-Log "ERREUR: Mauvais répertoire! Doit être dans mobile/" "Red"
    $errorsDetected++
    Add-Content -Path $errorLogFile -Value "[INIT] Mauvais répertoire: $currentDir"
} else {
    Write-Host "  [OK] Répertoire correct" -ForegroundColor Green
}

# 2. Vérifier les fichiers critiques
Write-Host ""
Write-Host "  Vérification fichiers critiques..." -ForegroundColor Gray
$missingFiles = Check-CriticalFiles
if ($missingFiles.Count -gt 0) {
    Write-Log "ERREUR: Fichiers manquants détectés!" "Red"
    foreach ($file in $missingFiles) {
        Write-Log "  - Manquant: $file" "Red"
        Add-Content -Path $errorLogFile -Value "[INIT] Fichier manquant: $file"
    }
    $errorsDetected += $missingFiles.Count
} else {
    Write-Host "  [OK] Tous les fichiers critiques présents" -ForegroundColor Green
}

# 3. Vérifier les modules
Write-Host ""
Write-Host "  Vérification modules Node..." -ForegroundColor Gray
$missingModules = Check-NodeModules
if ($missingModules.Count -gt 0) {
    Write-Log "AVERTISSEMENT: Modules manquants!" "Yellow"
    foreach ($module in $missingModules) {
        Write-Log "  - Manquant: $module" "Yellow"
        Add-Content -Path $errorLogFile -Value "[INIT] Module manquant: $module"
    }
    $warningsDetected += $missingModules.Count
} else {
    Write-Host "  [OK] Modules critiques présents" -ForegroundColor Green
}

# 4. Vérifier Metro
Write-Host ""
Write-Host "  Vérification Metro Bundler..." -ForegroundColor Gray
$metroProc = Check-MetroProcess
if ($metroProc) {
    Write-Host "  [OK] Metro actif - $($metroProc.Count) processus" -ForegroundColor Green
    Write-Host "  [OK] PID: $($metroProc.Id -join ', ')" -ForegroundColor Green
} else {
    Write-Log "AVERTISSEMENT: Metro non détecté" "Yellow"
    $warningsDetected++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MONITORING EN COURS..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Appuyez sur Ctrl+C pour arrêter le monitoring" -ForegroundColor Gray
Write-Host ""

# Boucle de monitoring
$continuousErrors = 0
$lastStatus = ""

try {
    while ($true) {
        $totalChecks++
        
        # Analyse de l'état Metro
        $analysis = Analyze-MetroOutput
        
        $statusChange = ($analysis.Status -ne $lastStatus)
        $lastStatus = $analysis.Status
        
        switch ($analysis.Severity) {
            "Critical" {
                if ($statusChange) {
                    Write-Log "[ERREUR CRITIQUE] $($analysis.Message)" "Red"
                    Add-Content -Path $errorLogFile -Value "[CRITICAL] $($analysis.Message)"
                }
                $errorsDetected++
                $continuousErrors++
            }
            "Warning" {
                if ($statusChange) {
                    Write-Log "[AVERTISSEMENT] $($analysis.Message)" "Yellow"
                    Add-Content -Path $errorLogFile -Value "[WARNING] $($analysis.Message)"
                }
                $warningsDetected++
                $continuousErrors++
            }
            "Info" {
                if ($statusChange) {
                    Write-Log "[OK] $($analysis.Message)" "Green"
                }
                $successfulBuilds++
                $continuousErrors = 0
            }
        }
        
        # Afficher un résumé toutes les 10 vérifications
        if ($totalChecks % 10 -eq 0) {
            $duration = (Get-Date) - $startTime
            Write-Host ""
            Write-Host "--- RÉSUMÉ (après $totalChecks vérifications) ---" -ForegroundColor Cyan
            Write-Host "  Durée: $($duration.ToString('mm\:ss'))" -ForegroundColor Gray
            Write-Host "  Erreurs détectées: $errorsDetected" -ForegroundColor $(if ($errorsDetected -eq 0) { "Green" } else { "Red" })
            Write-Host "  Avertissements: $warningsDetected" -ForegroundColor $(if ($warningsDetected -eq 0) { "Green" } else { "Yellow" })
            Write-Host "  Succès: $successfulBuilds" -ForegroundColor Green
            Write-Host "  État actuel: $($analysis.Status)" -ForegroundColor $(if ($analysis.Status -eq "SUCCESS") { "Green" } else { "Red" })
            Write-Host ""
        }
        
        # Alerte si erreurs continues
        if ($continuousErrors -ge 5) {
            Write-Host ""
            Write-Host "!!! ALERTE: 5+ erreurs consécutives détectées !!!" -ForegroundColor Red
            Write-Host "!!! Vérifiez les logs pour plus de détails !!!" -ForegroundColor Red
            Write-Host ""
            $continuousErrors = 0
        }
        
        # Attendre avant la prochaine vérification
        Start-Sleep -Seconds $checkInterval
    }
} catch {
    Write-Host ""
    Write-Log "Monitoring arrêté par l'utilisateur" "Yellow"
}

# Résumé final
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RÉSUMÉ FINAL DU MONITORING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$duration = (Get-Date) - $startTime
Write-Host "Durée totale: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor White
Write-Host "Vérifications effectuées: $totalChecks" -ForegroundColor Cyan
Write-Host "Erreurs détectées: $errorsDetected" -ForegroundColor $(if ($errorsDetected -eq 0) { "Green" } else { "Red" })
Write-Host "Avertissements détectés: $warningsDetected" -ForegroundColor $(if ($warningsDetected -eq 0) { "Green" } else { "Yellow" })
Write-Host "Succès enregistrés: $successfulBuilds" -ForegroundColor Green
Write-Host ""
Write-Host "Logs sauvegardés dans:" -ForegroundColor Cyan
Write-Host "  - $logFile" -ForegroundColor White
Write-Host "  - $errorLogFile" -ForegroundColor White
Write-Host ""

