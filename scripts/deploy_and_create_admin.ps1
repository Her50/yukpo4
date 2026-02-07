# Script pour forcer le redéploiement ECS et créer le compte admin
# Usage: .\scripts\deploy_and_create_admin.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REDÉPLOIEMENT ECS + CRÉATION ADMIN" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ÉTAPE 1: Forcer le redéploiement du service ECS
Write-Host "[ÉTAPE 1/2] Forçage du redéploiement du service ECS..." -ForegroundColor Yellow

try {
    $updateResult = aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --force-new-deployment `
        --region $REGION `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($updateResult.service) {
        Write-Host "[OK] Service ECS en cours de redéploiement..." -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Erreur lors du redéploiement" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Erreur: $_" -ForegroundColor Red
    exit 1
}

# ÉTAPE 2: Attendre que le déploiement soit terminé
Write-Host ""
Write-Host "[ÉTAPE 2/2] Attente de la fin du déploiement..." -ForegroundColor Yellow

$maxWait = 300  # 5 minutes max
$waited = 0
$interval = 10

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds $interval
    $waited += $interval
    
    $serviceStatus = aws ecs describe-services `
        --cluster $CLUSTER_NAME `
        --services $SERVICE_NAME `
        --region $REGION `
        --query 'services[0].{Running:runningCount,Desired:desiredCount,Deployments:deployments[*].{Status:status,Running:runningCount}}' `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($serviceStatus) {
        $running = $serviceStatus.Running
        $desired = $serviceStatus.Desired
        
        Write-Host "   [WAIT] Tâches: $running/$desired (attente: ${waited}s)" -ForegroundColor Gray
        
        # Vérifier si le déploiement est terminé
        $deployments = $serviceStatus.Deployments
        $primaryDeployment = $deployments | Where-Object { $_.Status -eq "PRIMARY" } | Select-Object -First 1
        
        if ($primaryDeployment -and $running -eq $desired -and $running -gt 0) {
            Write-Host "[OK] Service déployé et stable!" -ForegroundColor Green
            break
        }
    }
}

if ($waited -ge $maxWait) {
    Write-Host "[WARNING] Timeout d'attente du déploiement, continuation quand même..." -ForegroundColor Yellow
}

Write-Host "[INFO] Attente supplémentaire pour que le backend soit prêt (30 secondes)..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "[OK] Redéploiement terminé!" -ForegroundColor Green
Write-Host ""

# ÉTAPE 3: Créer le compte admin
Write-Host "[INFO] Lancement de la création du compte admin..." -ForegroundColor Cyan
Write-Host ""

& ".\scripts\create_admin_complete.ps1"

