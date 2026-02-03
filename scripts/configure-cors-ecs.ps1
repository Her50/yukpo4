# Script pour configurer CORS dans ECS
# Usage: .\scripts\configure-cors-ecs.ps1

Write-Host "🔧 Configuration CORS dans ECS..." -ForegroundColor Cyan

# Variables
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$TASK_DEFINITION_FAMILY = "yukpomnang-backend-task"
$REGION = "us-east-1"
$ALLOWED_ORIGINS = "*"

Write-Host "📋 Paramètres:" -ForegroundColor Yellow
Write-Host "  Cluster: $CLUSTER_NAME"
Write-Host "  Service: $SERVICE_NAME"
Write-Host "  Task Definition: $TASK_DEFINITION_FAMILY"
Write-Host "  Region: $REGION"
Write-Host "  ALLOWED_ORIGINS: $ALLOWED_ORIGINS"
Write-Host ""

# Vérifier que AWS CLI est installé
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ AWS CLI n est pas installe. Veuillez l installer d abord." -ForegroundColor Red
    Write-Host "   Téléchargement: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Vérifier que AWS CLI est configuré
Write-Host "🔍 Vérification de la configuration AWS CLI..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ AWS CLI n est pas configure. Veuillez executer aws configure d abord." -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS CLI configuré" -ForegroundColor Green
Write-Host ""

# Recuperer la derniere revision de la task definition
Write-Host "📥 Recuperation de la derniere revision de la task definition..." -ForegroundColor Cyan
$taskDefJson = aws ecs describe-task-definition `
    --task-definition $TASK_DEFINITION_FAMILY `
    --region $REGION `
    --query 'taskDefinition' `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la recuperation de la task definition." -ForegroundColor Red
    Write-Host "   Vérifiez que la task definition existe: $TASK_DEFINITION_FAMILY" -ForegroundColor Yellow
    exit 1
}

# Convertir le JSON en objet PowerShell
$taskDef = $taskDefJson | ConvertFrom-Json

# Vérifier si ALLOWED_ORIGINS existe déjà
$containerDef = $taskDef.containerDefinitions[0]
$envVars = $containerDef.environment
$allowedOriginsExists = $false
$allowedOriginsIndex = -1

if ($envVars) {
    for ($i = 0; $i -lt $envVars.Count; $i++) {
        if ($envVars[$i].name -eq "ALLOWED_ORIGINS") {
            $allowedOriginsExists = $true
            $allowedOriginsIndex = $i
            break
        }
    }
}

# Mettre à jour ou ajouter ALLOWED_ORIGINS
if ($allowedOriginsExists) {
    Write-Host "⚠️  ALLOWED_ORIGINS existe déjà: $($envVars[$allowedOriginsIndex].value)" -ForegroundColor Yellow
    Write-Host "🔄 Mise à jour vers: $ALLOWED_ORIGINS" -ForegroundColor Cyan
    $envVars[$allowedOriginsIndex].value = $ALLOWED_ORIGINS
} else {
    Write-Host "➕ Ajout de ALLOWED_ORIGINS: $ALLOWED_ORIGINS" -ForegroundColor Cyan
    if (-not $envVars) {
        $envVars = @()
    }
    $envVars += @{
        name = "ALLOWED_ORIGINS"
        value = $ALLOWED_ORIGINS
    }
    $containerDef.environment = $envVars
}

# Préparer la nouvelle task definition (sans certains champs non modifiables)
$newTaskDef = @{
    family = $taskDef.family
    containerDefinitions = $taskDef.containerDefinitions
    requiresCompatibilities = $taskDef.requiresCompatibilities
    cpu = $taskDef.cpu
    memory = $taskDef.memory
    networkMode = $taskDef.networkMode
    executionRoleArn = $taskDef.executionRoleArn
    taskRoleArn = $taskDef.taskRoleArn
} | ConvertTo-Json -Depth 10

# Sauvegarder dans un fichier temporaire
$tempFile = "task-definition-temp.json"
$newTaskDef | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host ""
Write-Host "📝 Creation d une nouvelle revision de la task definition..." -ForegroundColor Cyan
$registerResult = aws ecs register-task-definition `
    --cli-input-json "file://$tempFile" `
    --region $REGION `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la creation de la nouvelle revision." -ForegroundColor Red
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    exit 1
}

$newTaskDefObj = $registerResult | ConvertFrom-Json
$newRevision = $newTaskDefObj.taskDefinition.revision

Write-Host "✅ Nouvelle revision creee: ${TASK_DEFINITION_FAMILY}:${newRevision}" -ForegroundColor Green
Write-Host ""

# Nettoyer le fichier temporaire
Remove-Item $tempFile -ErrorAction SilentlyContinue

# Mettre à jour le service ECS
Write-Host "🔄 Mise à jour du service ECS..." -ForegroundColor Cyan
$updateResult = aws ecs update-service `
    --cluster $CLUSTER_NAME `
    --service $SERVICE_NAME `
    --task-definition "${TASK_DEFINITION_FAMILY}:${newRevision}" `
    --region $REGION `
    --force-new-deployment `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la mise a jour du service." -ForegroundColor Red
    Write-Host "   Vous pouvez mettre à jour manuellement le service avec:" -ForegroundColor Yellow
    Write-Host "   aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --task-definition ${TASK_DEFINITION_FAMILY}:${newRevision} --region $REGION --force-new-deployment" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Service ECS mis à jour avec succès!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Résumé:" -ForegroundColor Cyan
Write-Host "  ✅ ALLOWED_ORIGINS configuré: $ALLOWED_ORIGINS"
Write-Host "  ✅ Nouvelle revision: ${TASK_DEFINITION_FAMILY}:${newRevision}"
Write-Host "  ✅ Service ECS mis à jour"
Write-Host ""
Write-Host "⏳ Le deploiement peut prendre quelques minutes. Surveillez le service avec:" -ForegroundColor Yellow
Write-Host "   aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION" -ForegroundColor Gray

