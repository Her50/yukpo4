# Script pour configurer CORS dans ECS
# Usage: .\scripts\configure-cors-ecs-fixed.ps1

Write-Host "Configuration CORS dans ECS..." -ForegroundColor Cyan

# Variables
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$TASK_DEFINITION_FAMILY = "yukpomnang-backend"
$REGION = "us-east-1"
$ALLOWED_ORIGINS = "*"

Write-Host "Parametres:" -ForegroundColor Yellow
Write-Host "  Cluster: $CLUSTER_NAME"
Write-Host "  Service: $SERVICE_NAME"
Write-Host "  Task Definition: $TASK_DEFINITION_FAMILY"
Write-Host "  Region: $REGION"
Write-Host "  ALLOWED_ORIGINS: $ALLOWED_ORIGINS"
Write-Host ""

# Verifier que AWS CLI est installe
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n est pas installe. Veuillez l installer d abord." -ForegroundColor Red
    Write-Host "   Telechargement: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Verifier que AWS CLI est configure
Write-Host "Verification de la configuration AWS CLI..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: AWS CLI n est pas configure. Veuillez executer 'aws configure' d abord." -ForegroundColor Red
    exit 1
}
Write-Host "OK: AWS CLI configure" -ForegroundColor Green
Write-Host ""

# Recuperer la derniere revision de la task definition
Write-Host "Recuperation de la derniere revision de la task definition..." -ForegroundColor Cyan
$taskDefJson = aws ecs describe-task-definition `
    --task-definition $TASK_DEFINITION_FAMILY `
    --region $REGION `
    --query 'taskDefinition' `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Erreur lors de la recuperation de la task definition." -ForegroundColor Red
    Write-Host "   Verifiez que la task definition existe: $TASK_DEFINITION_FAMILY" -ForegroundColor Yellow
    exit 1
}

# Convertir le JSON en objet PowerShell
$taskDef = $taskDefJson | ConvertFrom-Json

# Verifier si ALLOWED_ORIGINS existe deja
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

# Mettre a jour ou ajouter ALLOWED_ORIGINS
if ($allowedOriginsExists) {
    Write-Host "ATTENTION: ALLOWED_ORIGINS existe deja: $($envVars[$allowedOriginsIndex].value)" -ForegroundColor Yellow
    Write-Host "Mise a jour vers: $ALLOWED_ORIGINS" -ForegroundColor Cyan
    $envVars[$allowedOriginsIndex].value = $ALLOWED_ORIGINS
} else {
    Write-Host "Ajout de ALLOWED_ORIGINS: $ALLOWED_ORIGINS" -ForegroundColor Cyan
    if (-not $envVars) {
        $envVars = @()
    }
    $envVars += @{
        name = "ALLOWED_ORIGINS"
        value = $ALLOWED_ORIGINS
    }
    $containerDef.environment = $envVars
}

# Preparer la nouvelle task definition (sans certains champs non modifiables)
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
# Utiliser UTF8NoBOM pour AWS CLI
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path .).Path + "\" + $tempFile, $newTaskDef, $utf8NoBom)

Write-Host ""
Write-Host "Creation d une nouvelle revision de la task definition..." -ForegroundColor Cyan
$registerResult = aws ecs register-task-definition `
    --cli-input-json "file://$tempFile" `
    --region $REGION `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Erreur lors de la creation de la nouvelle revision." -ForegroundColor Red
    Remove-Item $tempFile -ErrorAction SilentlyContinue
    exit 1
}

$newTaskDefObj = $registerResult | ConvertFrom-Json
$newRevision = $newTaskDefObj.taskDefinition.revision

Write-Host "OK: Nouvelle revision creee: ${TASK_DEFINITION_FAMILY}:${newRevision}" -ForegroundColor Green
Write-Host ""

# Nettoyer le fichier temporaire
Remove-Item $tempFile -ErrorAction SilentlyContinue

# Mettre a jour le service ECS
Write-Host "Mise a jour du service ECS..." -ForegroundColor Cyan
$taskDefFullName = "${TASK_DEFINITION_FAMILY}:${newRevision}"
$updateResult = aws ecs update-service `
    --cluster $CLUSTER_NAME `
    --service $SERVICE_NAME `
    --task-definition $taskDefFullName `
    --region $REGION `
    --force-new-deployment `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Erreur lors de la mise a jour du service." -ForegroundColor Red
    Write-Host "   Vous pouvez mettre a jour manuellement le service avec:" -ForegroundColor Yellow
    Write-Host "   aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --task-definition $taskDefFullName --region $REGION --force-new-deployment" -ForegroundColor Gray
    exit 1
}

Write-Host "OK: Service ECS mis a jour avec succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "  OK: ALLOWED_ORIGINS configure: $ALLOWED_ORIGINS"
Write-Host "  OK: Nouvelle revision: $taskDefFullName"
Write-Host "  OK: Service ECS mis a jour"
Write-Host ""
Write-Host "Le deploiement peut prendre quelques minutes. Surveillez le service avec:" -ForegroundColor Yellow
Write-Host "   aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION" -ForegroundColor Gray

