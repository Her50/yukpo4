# Script pour verifier que toutes les migrations sont appliquees dans la base de donnees PostgreSQL AWS
# Execute des requetes SQL via une tache ECS pour verifier l'etat des migrations

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$TASK_DEFINITION = "yukpomnang-backend"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Verification des migrations dans la base de donnees PostgreSQL AWS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# SQL de verification
$verificationSQL = @"
-- Verification 1: Colonnes de product_delivery_config
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN (
    'preparation_time_minutes',
    'storage_location_id',
    'max_preparation_time_minutes',
    'availability_days',
    'is_immediately_available'
)
ORDER BY column_name;

-- Verification 2: Index sur availability_days
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'product_delivery_config' 
AND indexname LIKE '%availability%';

-- Verification 3: Index sur storage_location_id
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'product_delivery_config' 
AND indexname LIKE '%storage_location%';

-- Verification 4: Table _sqlx_migrations (migrations SQLx)
SELECT 
    version,
    description,
    installed_on,
    success,
    checksum
FROM _sqlx_migrations
ORDER BY version DESC
LIMIT 20;

-- Verification 5: Nombre total de migrations appliquees
SELECT COUNT(*) as total_migrations FROM _sqlx_migrations WHERE success = true;
"@

Write-Host "Etape 1: Recuperation de la configuration reseau..." -ForegroundColor Yellow

try {
    $service = aws ecs describe-services `
        --cluster $CLUSTER_NAME `
        --services $SERVICE_NAME `
        --region $REGION `
        --query 'services[0]' `
        --output json | ConvertFrom-Json
    
    $networkConfig = $service.networkConfiguration.awsvpcConfiguration
    $subnetId = $networkConfig.subnets[0]
    $securityGroupId = $networkConfig.securityGroups[0]
    
    Write-Host "   Subnet: $subnetId" -ForegroundColor Gray
    Write-Host "   Security Group: $securityGroupId" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Etape 2: Creation d'une tache ECS pour executer les requetes SQL..." -ForegroundColor Yellow

# Encoder le SQL en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($verificationSQL))

# Creer la commande
$command = "sh -c `"echo `$VERIFICATION_SQL | base64 -d | psql `$DATABASE_URL`""

$networkConfigStr = "awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$securityGroupId],assignPublicIp=DISABLED}"
$overridesStr = "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"sh\",\"-c\",\"echo `$VERIFICATION_SQL | base64 -d | psql `$DATABASE_URL\"],\"environment\":[{\"name\":\"VERIFICATION_SQL\",\"value\":\"$sqlBase64\"}]}]}"

try {
    Write-Host "   Execution de la tache..." -ForegroundColor Gray
    
    $taskResult = aws ecs run-task `
        --cluster $CLUSTER_NAME `
        --task-definition $TASK_DEFINITION `
        --launch-type FARGATE `
        --network-configuration $networkConfigStr `
        --overrides $overridesStr `
        --region $REGION `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Erreur lors de la creation de la tache:" -ForegroundColor Red
        Write-Host $taskResult -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Utiliser ECS Exec sur une tache existante" -ForegroundColor Yellow
        exit 1
    }
    
    $taskJson = $taskResult | ConvertFrom-Json
    
    if (-not $taskJson.tasks -or $taskJson.tasks.Count -eq 0) {
        Write-Host "   Aucune tache creee" -ForegroundColor Red
        if ($taskJson.failures) {
            Write-Host "   Raison: $($taskJson.failures[0].reason)" -ForegroundColor Red
        }
        exit 1
    }
    
    $task = $taskJson.tasks[0]
    $taskArn = $task.taskArn
    $taskId = $taskArn -replace '.*/', ''
    
    Write-Host "   Tache creee: $taskId" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Etape 3: Attente de la fin de l'execution..." -ForegroundColor Yellow
    
    $maxWait = 180
    $elapsed = 0
    $completed = $false
    
    while ($elapsed -lt $maxWait -and -not $completed) {
        Start-Sleep -Seconds 10
        $elapsed += 10
        
        $taskInfo = aws ecs describe-tasks `
            --cluster $CLUSTER_NAME `
            --tasks $taskArn `
            --region $REGION `
            --query 'tasks[0]' `
            --output json | ConvertFrom-Json
        
        if ($taskInfo) {
            $status = $taskInfo.lastStatus
            if ($status -eq "STOPPED") {
                $completed = $true
                $exitCode = $taskInfo.containers[0].exitCode
                Write-Host "   Tache terminee (code: $exitCode)" -ForegroundColor Gray
            } else {
                Write-Host "   Statut: $status ($elapsed s)" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    
    Write-Host "Etape 4: Recuperation des resultats..." -ForegroundColor Yellow
    
    $logGroup = "/ecs/yukpomnang-backend"
    $logStream = "backend/backend/$taskId"
    
    Start-Sleep -Seconds 5
    
    try {
        $logs = aws logs get-log-events `
            --log-group-name $logGroup `
            --log-stream-name $logStream `
            --region $REGION `
            --start-time $([DateTimeOffset]::Now.AddMinutes(-10).ToUnixTimeMilliseconds()) `
            --query 'events[*].message' `
            --output text 2>&1
        
        if ($logs -and $logs -notmatch "ResourceNotFoundException") {
            Write-Host ""
            Write-Host "Resultats de la verification:" -ForegroundColor Cyan
            Write-Host "================================" -ForegroundColor Cyan
            Write-Host ""
            
            $logLines = $logs -split "`t" | Where-Object { $_.Trim() -ne "" }
            $logLines | ForEach-Object {
                $line = $_.Trim()
                if ($line -match "column_name|indexname|version|total_migrations") {
                    Write-Host $line -ForegroundColor Green
                } elseif ($line -match "ERROR|error|Error") {
                    Write-Host $line -ForegroundColor Red
                } else {
                    Write-Host $line -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "   Logs non disponibles" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   Erreur lors de la recuperation des logs: $_" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "Erreur: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Utiliser ECS Exec pour executer les requetes manuellement" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Verification terminee!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



