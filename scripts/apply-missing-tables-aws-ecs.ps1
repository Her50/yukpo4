# Script pour exécuter le binaire apply_missing_tables_aws dans AWS ECS
# Ce script crée toutes les tables manquantes via la migration consolidée

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$ServiceName = "yukpomnang-backend-service",
    [string]$Region = "eu-west-1",
    [string]$TaskDefinition = "yukpomnang-backend"
)

Write-Host "🚀 Exécution du binaire apply_missing_tables_aws dans AWS ECS..." -ForegroundColor Cyan
Write-Host ""

# Étape 1 : Vérifier qu'une tâche est en cours d'exécution
Write-Host "📋 Étape 1 : Vérification des tâches ECS en cours..." -ForegroundColor Yellow
$tasks = aws ecs list-tasks `
    --cluster $ClusterName `
    --service-name $ServiceName `
    --region $Region `
    --desired-status RUNNING `
    --query 'taskArns' `
    --output json | ConvertFrom-Json

if ($tasks.Count -eq 0) {
    Write-Host "❌ Aucune tâche en cours d'exécution pour le service $ServiceName" -ForegroundColor Red
    Write-Host "💡 Démarrez d'abord le service ECS ou utilisez une tâche one-shot" -ForegroundColor Yellow
    exit 1
}

$taskArn = $tasks[0]
Write-Host "✅ Tâche trouvée : $taskArn" -ForegroundColor Green
Write-Host ""

# Étape 2 : Vérifier que ECS Exec est activé
Write-Host "📋 Étape 2 : Vérification de ECS Exec..." -ForegroundColor Yellow
$clusterInfo = aws ecs describe-clusters `
    --clusters $ClusterName `
    --region $Region `
    --include CONFIGURATIONS `
    --query 'clusters[0].executeCommandConfiguration' `
    --output json | ConvertFrom-Json

if (-not $clusterInfo) {
    Write-Host "⚠️  ECS Exec n'est pas activé sur le cluster" -ForegroundColor Yellow
    Write-Host "🔧 Activation de ECS Exec..." -ForegroundColor Cyan
    aws ecs update-cluster `
        --cluster $ClusterName `
        --region $Region `
        --enable-execute-command | Out-Null
    Write-Host "✅ ECS Exec activé" -ForegroundColor Green
    Write-Host "⏳ Attente de 10 secondes pour que la configuration soit appliquée..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
} else {
    Write-Host "✅ ECS Exec est activé" -ForegroundColor Green
}
Write-Host ""

# Étape 3 : Exécuter le binaire via ECS Exec
Write-Host "📋 Étape 3 : Exécution du binaire apply_missing_tables_aws..." -ForegroundColor Yellow
Write-Host "💡 Le binaire va créer toutes les tables manquantes via la migration consolidée" -ForegroundColor Cyan
Write-Host ""

# Option A : Exécuter directement le binaire (si compilé dans l'image)
Write-Host "🔄 Tentative d'exécution directe du binaire..." -ForegroundColor Cyan
Write-Host ""

$command = "/app/yukpomnang_backend --bin apply_missing_tables_aws"

# Note: Le binaire Rust doit être compilé avec toutes les features
# Si le binaire n'existe pas, on peut utiliser cargo run
$cargoCommand = "cd /app && cargo run --bin apply_missing_tables_aws --release"

Write-Host "⚠️  Note: Le binaire doit être compilé dans l'image Docker" -ForegroundColor Yellow
Write-Host "💡 Si le binaire n'existe pas, utilisez l'option B ci-dessous" -ForegroundColor Yellow
Write-Host ""

# Exécuter via ECS Exec
Write-Host "🔧 Exécution de la commande dans le conteneur..." -ForegroundColor Cyan
Write-Host ""

try {
    # Essayer d'abord avec le binaire direct
    aws ecs execute-command `
        --cluster $ClusterName `
        --task $taskArn `
        --container backend `
        --command "/bin/bash" `
        --interactive `
        --region $Region
} catch {
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative : Créer une tâche ECS one-shot" -ForegroundColor Yellow
    Write-Host ""
    
    # Option B : Créer une tâche one-shot
    Write-Host "📋 Création d'une tâche ECS one-shot..." -ForegroundColor Yellow
    
    # Récupérer la task definition
    $taskDefArn = aws ecs describe-task-definition `
        --task-definition $TaskDefinition `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text
    
    Write-Host "✅ Task definition : $taskDefArn" -ForegroundColor Green
    
    # Récupérer les subnets et security groups depuis le service
    $serviceInfo = aws ecs describe-services `
        --cluster $ClusterName `
        --services $ServiceName `
        --region $Region `
        --query 'services[0].networkConfiguration.awsvpcConfiguration' `
        --output json | ConvertFrom-Json
    
    $subnets = $serviceInfo.subnets -join ","
    $securityGroups = $serviceInfo.securityGroups -join ","
    
    Write-Host "📋 Subnets : $subnets" -ForegroundColor Cyan
    Write-Host "📋 Security Groups : $securityGroups" -ForegroundColor Cyan
    Write-Host ""
    
    # Créer la tâche one-shot
    $taskOverride = @{
        containerOverrides = @(
            @{
                name = "backend"
                command = @(
                    "/bin/bash",
                    "-c",
                    "cd /app && /app/yukpomnang_backend --bin apply_missing_tables_aws || cargo run --bin apply_missing_tables_aws --release"
                )
            }
        )
    } | ConvertTo-Json -Depth 10
    
    Write-Host "🚀 Lancement de la tâche one-shot..." -ForegroundColor Cyan
    $runTaskResult = aws ecs run-task `
        --cluster $ClusterName `
        --task-definition $TaskDefinition `
        --launch-type FARGATE `
        --network-configuration "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=DISABLED}" `
        --overrides $taskOverride `
        --region $Region `
        --query 'tasks[0].taskArn' `
        --output text
    
    Write-Host "✅ Tâche one-shot créée : $runTaskResult" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Surveiller les logs avec :" -ForegroundColor Cyan
    Write-Host "   aws logs tail /ecs/yukpomnang-backend --follow --region $Region" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 Vérifier le statut avec :" -ForegroundColor Cyan
    Write-Host "   aws ecs describe-tasks --cluster $ClusterName --tasks $runTaskResult --region $Region" -ForegroundColor White
}

Write-Host ""
Write-Host "✅ Script terminé" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Instructions pour exécution manuelle :" -ForegroundColor Yellow
Write-Host "   1. Se connecter au conteneur ECS :" -ForegroundColor White
Write-Host "      aws ecs execute-command --cluster $ClusterName --task <TASK_ID> --container backend --command /bin/bash --interactive --region $Region" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Dans le conteneur, exécuter :" -ForegroundColor White
Write-Host "      cd /app" -ForegroundColor Gray
Write-Host "      /app/yukpomnang_backend --bin apply_missing_tables_aws" -ForegroundColor Gray
Write-Host "      # OU si le binaire n'existe pas :" -ForegroundColor Gray
Write-Host "      cargo run --bin apply_missing_tables_aws --release" -ForegroundColor Gray




