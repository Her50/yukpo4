# Script pour exécuter les migrations avec corrections automatiques
# Date: 2026-02-15

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Password = "TempPassword123!"
)

$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
}

$publicIp = "34.79.199.41"
$databaseUrl = "postgresql://${User}:${Password}@${publicIp}:5432/${DatabaseName}?sslmode=require"
$env:DATABASE_URL = $databaseUrl
$env:PGPASSWORD = $Password

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXECUTION MIGRATIONS AVEC CORRECTIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$maxIterations = 20
$iteration = 0
$success = $false

while ($iteration -lt $maxIterations -and -not $success) {
    $iteration++
    Write-Host "[ITERATION $iteration/$maxIterations] Execution des migrations..." -ForegroundColor Yellow
    
    Push-Location backend
    $output = cargo sqlx migrate run 2>&1
    $exitCode = $LASTEXITCODE
    Pop-Location
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Toutes les migrations ont ete appliquees!" -ForegroundColor Green
        $success = $true
        
        # Afficher le résumé
        Push-Location backend
        $info = cargo sqlx migrate info 2>&1
        $applied = ($info | Select-String -Pattern "applied").Count
        $pending = ($info | Select-String -Pattern "pending").Count
        Pop-Location
        
        Write-Host ""
        Write-Host "Migrations appliquees: $applied" -ForegroundColor Green
        Write-Host "Migrations en attente: $pending" -ForegroundColor $(if ($pending -eq 0) { "Green" } else { "Yellow" })
    } else {
        # Extraire l'erreur
        $errorLine = $output | Select-String -Pattern "error:" | Select-Object -First 1
        Write-Host ""
        Write-Host "[ERREUR] $errorLine" -ForegroundColor Red
        
        # Essayer de corriger automatiquement
        if ($errorLine -match "column `"(\w+)`" does not exist") {
            $columnName = $matches[1]
            Write-Host "[INFO] Colonne manquante detectee: $columnName" -ForegroundColor Yellow
            Write-Host "[INFO] Correction manuelle requise dans la migration" -ForegroundColor Yellow
        } elseif ($errorLine -match "table `"(\w+)`" does not exist") {
            $tableName = $matches[1]
            Write-Host "[INFO] Table manquante detectee: $tableName" -ForegroundColor Yellow
        } elseif ($errorLine -match "relation `"(\w+)`" already exists") {
            $relationName = $matches[1]
            Write-Host "[INFO] Relation existante detectee: $relationName" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "Dernieres lignes d'erreur:" -ForegroundColor Yellow
        $output | Select-Object -Last 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        
        if ($iteration -lt $maxIterations) {
            Write-Host ""
            Write-Host "Appuyez sur Entree pour continuer avec la correction manuelle..." -ForegroundColor Cyan
            Read-Host
        }
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "[ATTENTION] Maximum d'iterations atteint. Corrections manuelles requises." -ForegroundColor Yellow
}

$env:DATABASE_URL = $null
$env:PGPASSWORD = $null


