# Script PowerShell pour créer une tâche ECS one-shot et exécuter les migrations
# Usage: .\scripts\run-migrations-ecs-task.ps1

$ErrorActionPreference = "Stop"

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$TASK_FAMILY = "${PROJECT_NAME}-backend"
$SUBNET_ID = ""  # À remplir avec un subnet ID du VPC
$SECURITY_GROUP_ID = ""  # À remplir avec le security group ID

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔄 Création d'une tâche ECS one-shot pour exécuter les migrations" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Récupérer les informations de la task definition
Write-Host "🔍 Récupération de la task definition..." -ForegroundColor Cyan
$taskDef = aws ecs describe-task-definition `
    --task-definition $TASK_FAMILY `
    --region $REGION `
    --query 'taskDefinition' `
    --output json | ConvertFrom-Json

if (-not $taskDef) {
    Write-Host "❌ Impossible de récupérer la task definition" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Task definition récupérée (revision: $($taskDef.revision))" -ForegroundColor Green
Write-Host ""

# Récupérer les subnets et security groups du VPC
Write-Host "🔍 Récupération des informations réseau..." -ForegroundColor Cyan
$vpcId = aws ec2 describe-vpcs `
    --filters "Name=tag:Name,Values=${PROJECT_NAME}-vpc" `
    --region $REGION `
    --query 'Vpcs[0].VpcId' `
    --output text

if (-not $vpcId) {
    Write-Host "⚠️ VPC non trouvé, récupération des subnets publics..." -ForegroundColor Yellow
    $subnets = aws ec2 describe-subnets `
        --filters "Name=tag:Name,Values=${PROJECT_NAME}*" `
        --region $REGION `
        --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' `
        --output text
} else {
    Write-Host "✅ VPC trouvé: $vpcId" -ForegroundColor Green
    $subnets = aws ec2 describe-subnets `
        --filters "Name=vpc-id,Values=$vpcId" `
        --region $REGION `
        --query 'Subnets[0].SubnetId' `
        --output text
}

if (-not $subnets) {
    Write-Host "❌ Aucun subnet trouvé" -ForegroundColor Red
    exit 1
}

$subnetId = ($subnets -split "`t")[0]
Write-Host "✅ Subnet sélectionné: $subnetId" -ForegroundColor Green

# Récupérer le security group
$securityGroups = aws ec2 describe-security-groups `
    --filters "Name=tag:Name,Values=${PROJECT_NAME}-ecs-sg" `
    --region $REGION `
    --query 'SecurityGroups[0].GroupId' `
    --output text

if (-not $securityGroups) {
    Write-Host "⚠️ Security group non trouvé, utilisation du default" -ForegroundColor Yellow
    $securityGroups = aws ec2 describe-security-groups `
        --filters "Name=group-name,Values=default" `
        --region $REGION `
        --query 'SecurityGroups[0].GroupId' `
        --output text
}

Write-Host "✅ Security group sélectionné: $securityGroups" -ForegroundColor Green
Write-Host ""

# Créer la commande pour exécuter les migrations
$migrationScript = @"
#!/bin/bash
set -e
cd /app/backend || cd backend
echo '🔍 Vérification de l''état des migrations...'
sqlx migrate info || echo '⚠️ Erreur lors de la vérification (peut être normal)'
echo ''
echo '🚀 Exécution des migrations SQLx...'
sqlx migrate run
echo ''
echo '✅ Migrations exécutées avec succès'
"@

# Créer un fichier temporaire avec le script
$scriptFile = [System.IO.Path]::GetTempFileName()
$migrationScript | Out-File -FilePath $scriptFile -Encoding utf8 -NoNewline

Write-Host "📝 Script de migration créé: $scriptFile" -ForegroundColor Green
Write-Host ""

# Afficher les instructions pour exécution manuelle
Write-Host "📋 Instructions pour exécuter les migrations:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Via ECS Exec (si activé sur les nouvelles tâches):" -ForegroundColor Cyan
Write-Host "  aws ecs execute-command \`" -ForegroundColor Gray
Write-Host "    --cluster $CLUSTER_NAME \`" -ForegroundColor Gray
Write-Host "    --task <TASK_ARN> \`" -ForegroundColor Gray
Write-Host "    --container backend \`" -ForegroundColor Gray
Write-Host "    --command '/bin/bash' \`" -ForegroundColor Gray
Write-Host "    --interactive \`" -ForegroundColor Gray
Write-Host "    --region $REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "  Puis dans le shell:" -ForegroundColor Gray
Write-Host "    cd /app/backend" -ForegroundColor Gray
Write-Host "    sqlx migrate info" -ForegroundColor Gray
Write-Host "    sqlx migrate run" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 2: Créer une tâche one-shot (nécessite configuration réseau):" -ForegroundColor Cyan
Write-Host "  aws ecs run-task \`" -ForegroundColor Gray
Write-Host "    --cluster $CLUSTER_NAME \`" -ForegroundColor Gray
Write-Host "    --task-definition $TASK_FAMILY \`" -ForegroundColor Gray
Write-Host "    --launch-type FARGATE \`" -ForegroundColor Gray
Write-Host "    --network-configuration `"awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$securityGroups],assignPublicIp=ENABLED}`" \`" -ForegroundColor Gray
Write-Host "    --overrides `"{\`"containerOverrides\`":[{\`"name\`":\`"backend\`",\`"command\`":[\`"/bin/bash\`",\`"-c\`",\`"cd /app/backend && sqlx migrate run\`"]}]}\`" \`" -ForegroundColor Gray
Write-Host "    --region $REGION" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 3: Utiliser le script Python localement (si accès réseau à RDS):" -ForegroundColor Cyan
Write-Host "  .\scripts\run-fix-missing-tables-local.ps1" -ForegroundColor Gray
Write-Host ""

Write-Host "=================================================================================="
Write-Host "✅ Instructions affichées" -ForegroundColor Green
Write-Host "=================================================================================="

