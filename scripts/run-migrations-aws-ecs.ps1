# Script PowerShell pour exécuter les migrations via ECS Task
# Utilise une tâche ECS one-shot pour exécuter les migrations dans le VPC privé

param(
    [string]$ClusterName = "yukpo-cluster",
    [string]$Region = "eu-west-1",
    [string]$TaskDefinition = "yukpo-backend"
)

Write-Host "Execution des migrations SQLx via ECS Task..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que AWS CLI est disponible
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: AWS CLI n'est pas installe" -ForegroundColor Red
    exit 1
}

# Récupérer les informations du cluster
Write-Host "Recuperation des informations du cluster..." -ForegroundColor Yellow
$clusterInfo = aws ecs describe-clusters --clusters $ClusterName --region $Region --query 'clusters[0]' | ConvertFrom-Json

if (-not $clusterInfo -or $clusterInfo.status -ne "ACTIVE") {
    Write-Host "ERREUR: Cluster $ClusterName non trouve ou inactif" -ForegroundColor Red
    exit 1
}

Write-Host "Cluster: $ClusterName" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Green
Write-Host ""

# Récupérer les subnets privés
Write-Host "Recuperation des subnets prives..." -ForegroundColor Yellow
$subnets = aws ec2 describe-subnets `
    --filters "Name=tag:Name,Values=yukpo-private-subnet-*" `
    --region $Region `
    --query 'Subnets[*].SubnetId' `
    --output text

if ([string]::IsNullOrEmpty($subnets)) {
    Write-Host "ERREUR: Impossible de trouver les subnets prives" -ForegroundColor Red
    exit 1
}

$subnetArray = $subnets -split '\s+'
Write-Host "Subnets trouves: $($subnetArray.Count)" -ForegroundColor Green
Write-Host ""

# Récupérer le security group ECS
Write-Host "Recuperation du security group ECS..." -ForegroundColor Yellow
$securityGroup = aws ec2 describe-security-groups `
    --filters "Name=tag:Name,Values=yukpo-ecs-sg" `
    --region $Region `
    --query 'SecurityGroups[0].GroupId' `
    --output text

if ([string]::IsNullOrEmpty($securityGroup)) {
    Write-Host "ERREUR: Impossible de trouver le security group ECS" -ForegroundColor Red
    exit 1
}

Write-Host "Security Group: $securityGroup" -ForegroundColor Green
Write-Host ""

# Construire la configuration réseau
$networkConfig = @{
    awsvpcConfiguration = @{
        subnets = $subnetArray
        securityGroups = @($securityGroup)
        assignPublicIp = "DISABLED"
    }
} | ConvertTo-Json -Compress

# Récupérer DATABASE_URL depuis SSM
Write-Host "Recuperation de DATABASE_URL depuis SSM..." -ForegroundColor Yellow
$databaseUrl = aws ssm get-parameter `
    --name "/yukpo/production/DATABASE_URL" `
    --region $Region `
    --with-decryption `
    --query 'Parameter.Value' `
    --output text

if ([string]::IsNullOrEmpty($databaseUrl)) {
    Write-Host "ERREUR: Impossible de recuperer DATABASE_URL depuis SSM" -ForegroundColor Red
    exit 1
}

Write-Host "DATABASE_URL recuperee" -ForegroundColor Green
Write-Host ""

# Construire la commande pour exécuter les migrations
# Note: Le conteneur doit avoir sqlx-cli installé
$command = @(
    "bash",
    "-c",
    "cd /app && export DATABASE_URL='$databaseUrl' && sqlx migrate run"
)

$commandJson = $command | ConvertTo-Json

# Créer les overrides pour la tâche
$overrides = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = $command
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Lancement de la tache ECS pour executer les migrations..." -ForegroundColor Yellow
Write-Host ""

# Exécuter la tâche
$taskResult = aws ecs run-task `
    --cluster $ClusterName `
    --task-definition $TaskDefinition `
    --launch-type FARGATE `
    --network-configuration $networkConfig `
    --overrides $overrides `
    --region $Region `
    --query 'tasks[0].{TaskArn:taskArn,LastStatus:lastStatus}' `
    --output json | ConvertFrom-Json

if (-not $taskResult -or -not $taskResult.TaskArn) {
    Write-Host "ERREUR: Impossible de lancer la tache ECS" -ForegroundColor Red
    exit 1
}

$taskArn = $taskResult.TaskArn
Write-Host "Tache lancee: $taskArn" -ForegroundColor Green
Write-Host ""

# Attendre que la tâche se termine
Write-Host "Attente de la fin de la tache..." -ForegroundColor Yellow
Write-Host "(Cela peut prendre quelques minutes)" -ForegroundColor Gray
Write-Host ""

$maxWaitTime = 600  # 10 minutes
$elapsed = 0
$interval = 10  # Vérifier toutes les 10 secondes

while ($elapsed -lt $maxWaitTime) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval
    
    $taskStatus = aws ecs describe-tasks `
        --cluster $ClusterName `
        --tasks $taskArn `
        --region $Region `
        --query 'tasks[0].{LastStatus:lastStatus,DesiredStatus:desiredStatus,StoppedReason:stoppedReason,Containers:containers[0].{ExitCode:exitCode,Reason:reason}}' `
        --output json | ConvertFrom-Json
    
    if ($taskStatus.LastStatus -eq "STOPPED") {
        Write-Host ""
        Write-Host "Tache terminee" -ForegroundColor Green
        Write-Host "Status: $($taskStatus.LastStatus)" -ForegroundColor Gray
        Write-Host "Exit Code: $($taskStatus.Containers.ExitCode)" -ForegroundColor Gray
        
        if ($taskStatus.Containers.ExitCode -eq 0) {
            Write-Host ""
            Write-Host "SUCCES: Migrations executees avec succes!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "ERREUR: La tache a echoue (Exit Code: $($taskStatus.Containers.ExitCode))" -ForegroundColor Red
            Write-Host "Raison: $($taskStatus.Containers.Reason)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Pour voir les logs:" -ForegroundColor Cyan
            Write-Host "aws logs tail /ecs/yukpo-backend --region $Region --follow" -ForegroundColor White
        }
        
        break
    }
    
    Write-Host "." -NoNewline -ForegroundColor Gray
}

if ($elapsed -ge $maxWaitTime) {
    Write-Host ""
    Write-Host "TIMEOUT: La tache n'a pas termine dans les delais" -ForegroundColor Yellow
    Write-Host "Tache ARN: $taskArn" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Pour verifier le statut manuellement:" -ForegroundColor Cyan
    Write-Host "aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region" -ForegroundColor White
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

