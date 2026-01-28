# Script simplifie pour mettre a jour la task definition ECS
# Usage: .\scripts\update-ecs-task-definition-simple.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$TASK_FAMILY = "${PROJECT_NAME}-backend"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"
$ACCOUNT_ID = aws sts get-caller-identity --region $REGION --query 'Account' --output text

Write-Host "[INFO] Export de la task definition actuelle..." -ForegroundColor Cyan

# Exporter la task definition dans un fichier
$tempFile = "task-def-temp.json"
aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $REGION --query 'taskDefinition' --output json | Out-File -FilePath $tempFile -Encoding utf8

if (-not (Test-Path $tempFile)) {
    Write-Host "[ERROR] Impossible de recuperer la task definition" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Task definition exportee dans $tempFile" -ForegroundColor Green

# Lire le JSON
$taskDefJson = Get-Content $tempFile -Raw | ConvertFrom-Json

# Ajouter les secrets manquants
$secrets = $taskDefJson.containerDefinitions[0].secrets
$secretsToAdd = @(
    @{ name = "ENABLE_AUTO_MIGRATIONS"; arn = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${PROJECT_NAME}/${ENVIRONMENT}/ENABLE_AUTO_MIGRATIONS" },
    @{ name = "S3_BUCKET"; arn = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${PROJECT_NAME}/${ENVIRONMENT}/S3_BUCKET" },
    @{ name = "S3_REGION"; arn = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${PROJECT_NAME}/${ENVIRONMENT}/S3_REGION" },
    @{ name = "UPLOAD_BASE_URL"; arn = "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${PROJECT_NAME}/${ENVIRONMENT}/UPLOAD_BASE_URL" }
)

foreach ($secretToAdd in $secretsToAdd) {
    $exists = $secrets | Where-Object { $_.name -eq $secretToAdd.name }
    if (-not $exists) {
        Write-Host "[ADD] Ajout de $($secretToAdd.name)..." -ForegroundColor Yellow
        $secrets += @{
            name      = $secretToAdd.name
            valueFrom = $secretToAdd.arn
        }
    } else {
        Write-Host "[SKIP] $($secretToAdd.name) existe deja" -ForegroundColor Gray
    }
}

# Mettre a jour le JSON
$taskDefJson.containerDefinitions[0].secrets = $secrets

# Supprimer les champs non necessaires pour register-task-definition
$taskDefJson.PSObject.Properties.Remove('taskDefinitionArn')
$taskDefJson.PSObject.Properties.Remove('revision')
$taskDefJson.PSObject.Properties.Remove('status')
$taskDefJson.PSObject.Properties.Remove('requiresAttributes')
$taskDefJson.PSObject.Properties.Remove('compatibilities')
$taskDefJson.PSObject.Properties.Remove('registeredAt')
$taskDefJson.PSObject.Properties.Remove('registeredBy')

# Sauvegarder
$newTaskDefFile = "task-def-new.json"
$taskDefJson | ConvertTo-Json -Depth 20 | Out-File -FilePath $newTaskDefFile -Encoding utf8

Write-Host "[INFO] Nouvelle task definition dans $newTaskDefFile" -ForegroundColor Cyan
Write-Host "[INFO] Enregistrement..." -ForegroundColor Cyan

# Enregistrer
$registerResult = aws ecs register-task-definition --cli-input-json "file://$newTaskDefFile" --region $REGION --output json | ConvertFrom-Json

if (-not $registerResult.taskDefinition) {
    Write-Host "[ERROR] Echec de l'enregistrement" -ForegroundColor Red
    Remove-Item $tempFile, $newTaskDefFile -ErrorAction SilentlyContinue
    exit 1
}

$newRevision = $registerResult.taskDefinition.revision
Write-Host "[OK] Task definition enregistree (revision: $newRevision)" -ForegroundColor Green

# Mettre a jour le service
Write-Host "[INFO] Mise a jour du service ECS..." -ForegroundColor Cyan

aws ecs update-service `
    --cluster $CLUSTER_NAME `
    --service $SERVICE_NAME `
    --task-definition "${TASK_FAMILY}:${newRevision}" `
    --region $REGION `
    --force-new-deployment | Out-Null

Write-Host "[OK] Service ECS mis a jour!" -ForegroundColor Green
Write-Host "[SUCCESS] Termine! Revision: ${TASK_FAMILY}:${newRevision}" -ForegroundColor Green

# Nettoyer
Remove-Item $tempFile, $newTaskDefFile -ErrorAction SilentlyContinue

