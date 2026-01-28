# Script PowerShell pour mettre a jour la task definition ECS avec ENABLE_AUTO_MIGRATIONS + S3
# Usage: .\scripts\update-ecs-task-definition-s3-migrations.ps1

$ErrorActionPreference = "Stop"

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$TASK_FAMILY = "${PROJECT_NAME}-backend"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"

Write-Host "[INFO] Recuperation de la task definition actuelle..." -ForegroundColor Cyan

# Recuperer la task definition actuelle
$currentTaskDef = aws ecs describe-task-definition `
    --task-definition $TASK_FAMILY `
    --region $REGION `
    --query 'taskDefinition' `
    --output json | ConvertFrom-Json

if (-not $currentTaskDef) {
    Write-Host "[ERROR] Impossible de recuperer la task definition '$TASK_FAMILY'" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Task definition recuperee (revision: $($currentTaskDef.revision))" -ForegroundColor Green

# Recuperer l'account ID
$accountId = aws sts get-caller-identity --region $REGION --query 'Account' --output text

# Modifier la definition du conteneur
$containerDef = $currentTaskDef.containerDefinitions[0]

# Ajouter les parametres manquants depuis SSM Parameter Store
$paramsToAdd = @(
    @{ name = "ENABLE_AUTO_MIGRATIONS"; paramPath = "/${PROJECT_NAME}/${ENVIRONMENT}/ENABLE_AUTO_MIGRATIONS" },
    @{ name = "S3_BUCKET"; paramPath = "/${PROJECT_NAME}/${ENVIRONMENT}/S3_BUCKET" },
    @{ name = "S3_REGION"; paramPath = "/${PROJECT_NAME}/${ENVIRONMENT}/S3_REGION" },
    @{ name = "UPLOAD_BASE_URL"; paramPath = "/${PROJECT_NAME}/${ENVIRONMENT}/UPLOAD_BASE_URL" }
)

foreach ($param in $paramsToAdd) {
    $exists = $containerDef.secrets | Where-Object { $_.name -eq $param.name }
    if (-not $exists) {
        Write-Host "[ADD] Ajout de $($param.name) depuis SSM..." -ForegroundColor Yellow
        $containerDef.secrets += @{
            name      = $param.name
            valueFrom = "arn:aws:ssm:${REGION}:${accountId}:parameter$($param.paramPath)"
        }
    } else {
        Write-Host "[SKIP] $($param.name) existe deja" -ForegroundColor Gray
    }
}

# Creer la nouvelle task definition JSON
$newTaskDef = @{
    family                  = $currentTaskDef.family
    networkMode            = $currentTaskDef.networkMode
    requiresCompatibilities = $currentTaskDef.requiresCompatibilities
    cpu                     = $currentTaskDef.cpu
    memory                  = $currentTaskDef.memory
    executionRoleArn        = $currentTaskDef.executionRoleArn
    taskRoleArn             = $currentTaskDef.taskRoleArn
    containerDefinitions    = @($containerDef)
    tags                    = $currentTaskDef.tags
} | ConvertTo-Json -Depth 10

# Sauvegarder temporairement
$tempFile = [System.IO.Path]::GetTempFileName() + ".json"
$newTaskDef | Out-File -FilePath $tempFile -Encoding utf8

Write-Host "[INFO] Nouvelle task definition sauvegardee dans: $tempFile" -ForegroundColor Cyan
Write-Host "[INFO] Enregistrement de la nouvelle task definition..." -ForegroundColor Cyan

# Enregistrer la nouvelle task definition
$registerResult = aws ecs register-task-definition `
    --cli-input-json "file://$tempFile" `
    --region $REGION `
    --output json | ConvertFrom-Json

if (-not $registerResult -or -not $registerResult.taskDefinition) {
    Write-Host "[ERROR] Echec de l'enregistrement de la task definition" -ForegroundColor Red
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    exit 1
}

$newRevision = $registerResult.taskDefinition.revision
Write-Host "[OK] Nouvelle task definition enregistree (revision: $newRevision)" -ForegroundColor Green

# Mettre a jour le service ECS
Write-Host "[INFO] Mise a jour du service ECS..." -ForegroundColor Cyan

$updateResult = aws ecs update-service `
    --cluster $CLUSTER_NAME `
    --service $SERVICE_NAME `
    --task-definition "${TASK_FAMILY}:$newRevision" `
    --region $REGION `
    --force-new-deployment `
    --output json | ConvertFrom-Json

if (-not $updateResult -or -not $updateResult.service) {
    Write-Host "[ERROR] Echec de la mise a jour du service" -ForegroundColor Red
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "[OK] Service ECS mis a jour avec succes!" -ForegroundColor Green
Write-Host "[INFO] Nouvelle task definition: ${TASK_FAMILY}:$newRevision" -ForegroundColor Cyan
Write-Host "[INFO] Le deploiement est en cours. Verifiez les logs CloudWatch pour suivre le demarrage." -ForegroundColor Yellow

# Nettoyer
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[SUCCESS] Termine! Les nouvelles variables d'environnement seront disponibles apres le redemarrage des conteneurs." -ForegroundColor Green
Write-Host ""
Write-Host "Variables ajoutees:" -ForegroundColor Cyan
Write-Host "  - ENABLE_AUTO_MIGRATIONS (depuis SSM Parameter Store)" -ForegroundColor White
Write-Host "  - S3_BUCKET (depuis SSM Parameter Store)" -ForegroundColor White
Write-Host "  - S3_REGION (depuis SSM Parameter Store)" -ForegroundColor White
Write-Host "  - UPLOAD_BASE_URL (depuis SSM Parameter Store)" -ForegroundColor White
Write-Host ""
Write-Host "Note: S3_ACCESS_KEY et S3_SECRET_KEY existent deja dans la task definition." -ForegroundColor Gray
