# Script pour verifier les migrations via une tache ECS one-shot
# Execute des requetes SQL directement dans PostgreSQL

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$TASK_DEFINITION = "yukpomnang-backend"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Verification des migrations dans PostgreSQL AWS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# SQL de verification
$sqlContent = @"
SELECT 
    'COLONNES' as type_check,
    column_name, 
    data_type, 
    is_nullable
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

SELECT 
    'INDEXES' as type_check,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'product_delivery_config' 
AND (indexname LIKE '%availability%' OR indexname LIKE '%storage_location%');

SELECT 
    'MIGRATIONS' as type_check,
    version::text,
    description,
    installed_on::text,
    success::text
FROM _sqlx_migrations
ORDER BY version DESC
LIMIT 10;

SELECT 
    'TOTAL' as type_check,
    COUNT(*)::text as total_migrations
FROM _sqlx_migrations 
WHERE success = true;
"@

Write-Host "Etape 1: Recuperation de la configuration reseau..." -ForegroundColor Yellow

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

# Encoder le SQL en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlContent))

Write-Host "Etape 2: Creation d'une tache ECS pour executer les requetes..." -ForegroundColor Yellow

$networkConfigStr = "awsvpcConfiguration={subnets=[$subnetId],securityGroups=[$securityGroupId],assignPublicIp=DISABLED}"

# Creer les overrides avec ConvertTo-Json pour eviter les problemes d'echappement
$overridesObj = @{
    containerOverrides = @(
        @{
            name = "backend"
            command = @("sh", "-c", "echo `$SQL_CONTENT | base64 -d | psql `$DATABASE_URL")
            environment = @(
                @{
                    name = "SQL_CONTENT"
                    value = $sqlBase64
                }
            )
        }
    )
}
$overridesStr = $overridesObj | ConvertTo-Json -Depth 10 -Compress

try {
    $taskResult = aws ecs run-task `
        --cluster $CLUSTER_NAME `
        --task-definition $TASK_DEFINITION `
        --launch-type FARGATE `
        --network-configuration $networkConfigStr `
        --overrides $overridesStr `
        --region $REGION `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur: $taskResult" -ForegroundColor Red
        Write-Host ""
        Write-Host "Note: Les taches one-shot peuvent echouer si les permissions SSM ne sont pas configurees." -ForegroundColor Yellow
        Write-Host "Les migrations peuvent quand meme etre appliquees via auto_migrate.rs au demarrage du service." -ForegroundColor Gray
        exit 1
    }
    
    $taskJson = $taskResult | ConvertFrom-Json
    
    if (-not $taskJson.tasks -or $taskJson.tasks.Count -eq 0) {
        Write-Host "Aucune tache creee" -ForegroundColor Red
        if ($taskJson.failures) {
            Write-Host "Raison: $($taskJson.failures[0].reason)" -ForegroundColor Red
        }
        exit 1
    }
    
    $task = $taskJson.tasks[0]
    $taskArn = $task.taskArn
    $taskId = $taskArn -replace '.*/', ''
    
    Write-Host "Tache creee: $taskId" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Etape 3: Attente de la fin de l'execution (peut prendre 1-2 minutes)..." -ForegroundColor Yellow
    
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
                Write-Host "Tache terminee (code: $exitCode)" -ForegroundColor Gray
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
        $inResults = $false
        
        foreach ($line in $logLines) {
            $line = $line.Trim()
            if ($line -match "type_check|column_name|indexname|version|total_migrations|COLONNES|INDEXES|MIGRATIONS|TOTAL") {
                $inResults = $true
                Write-Host $line -ForegroundColor Green
            } elseif ($inResults -and $line -match "^\|" -or $line -match "^-" -or $line -match "^\s*\d") {
                Write-Host $line -ForegroundColor Gray
            } elseif ($line -match "ERROR|error|Error|failed|Failed") {
                Write-Host $line -ForegroundColor Red
            } elseif ($inResults) {
                Write-Host $line -ForegroundColor Gray
            }
        }
        
        if (-not $inResults) {
            Write-Host "Aucun resultat specifique trouve. Affichage des derniers logs:" -ForegroundColor Yellow
            $logLines | Select-Object -Last 20 | ForEach-Object {
                Write-Host $_ -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "Logs non disponibles encore. La tache vient peut-etre de se terminer." -ForegroundColor Yellow
        Write-Host "Verifiez manuellement: aws logs tail $logGroup --follow --region $REGION" -ForegroundColor Gray
    }
    
} catch {
    Write-Host ""
    Write-Host "Erreur: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Note: Si les permissions SSM ne sont pas configurees, cette methode peut echouer." -ForegroundColor Yellow
    Write-Host "Les migrations sont appliquees automatiquement via auto_migrate.rs au demarrage du service." -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Verification terminee!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""

