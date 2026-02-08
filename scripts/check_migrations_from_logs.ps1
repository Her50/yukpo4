# Script pour verifier les migrations via les logs du service ECS
# Cherche les traces d'execution des migrations dans les logs CloudWatch

$ErrorActionPreference = "Continue"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"
$LOG_GROUP = "/ecs/yukpomnang-backend"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Verification des migrations via les logs CloudWatch" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

Write-Host "Etape 1: Recherche des taches recentes..." -ForegroundColor Yellow

$tasks = aws ecs list-tasks `
    --cluster $CLUSTER_NAME `
    --service-name $SERVICE_NAME `
    --desired-status RUNNING `
    --region $REGION `
    --query 'taskArns[]' `
    --output json | ConvertFrom-Json

if (-not $tasks -or $tasks.Count -eq 0) {
    Write-Host "Aucune tache en cours" -ForegroundColor Yellow
    Write-Host "Recherche des taches arretes recentes..." -ForegroundColor Gray
    
    $allTasks = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --region $REGION `
        --query 'taskArns[]' `
        --output json | ConvertFrom-Json
    
    if ($allTasks -and $allTasks.Count -gt 0) {
        $tasks = $allTasks[0..([Math]::Min(3, $allTasks.Count - 1))]
    }
}

if (-not $tasks) {
    Write-Host "Aucune tache trouvee" -ForegroundColor Red
    exit 1
}

Write-Host "Taches trouvees: $($tasks.Count)" -ForegroundColor Green
Write-Host ""

Write-Host "Etape 2: Recherche des logs de migration (dernieres 2 heures)..." -ForegroundColor Yellow

$startTime = [DateTimeOffset]::Now.AddHours(-2).ToUnixTimeMilliseconds()

# Rechercher dans les logs pour les patterns de migration
$patterns = @(
    "migration",
    "Migration",
    "preparation_time",
    "storage_location",
    "ALTER TABLE",
    "CREATE INDEX",
    "auto_migrate",
    "ENABLE_AUTO_MIGRATIONS",
    "sqlx migrate"
)

Write-Host "Recherche des patterns: $($patterns -join ', ')" -ForegroundColor Gray
Write-Host ""

$foundMigrations = $false

foreach ($pattern in $patterns) {
    Write-Host "Recherche du pattern: $pattern" -ForegroundColor Gray
    
    $logs = aws logs filter-log-events `
        --log-group-name $LOG_GROUP `
        --region $REGION `
        --start-time $startTime `
        --filter-pattern $pattern `
        --max-items 50 `
        --query 'events[*].message' `
        --output text 2>&1
    
    if ($logs -and $logs -notmatch "ResourceNotFoundException" -and $logs.Trim() -ne "") {
        $foundMigrations = $true
        Write-Host "   Resultats trouves pour '$pattern':" -ForegroundColor Green
        
        $logLines = $logs -split "`t" | Where-Object { $_.Trim() -ne "" } | Select-Object -First 10
        foreach ($line in $logLines) {
            $line = $line.Trim()
            if ($line.Length -gt 0) {
                Write-Host "   - $line" -ForegroundColor Gray
            }
        }
        Write-Host ""
    }
}

if (-not $foundMigrations) {
    Write-Host "Aucun log de migration trouve dans les dernieres 2 heures" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Cela peut signifier:" -ForegroundColor Cyan
    Write-Host "   1. Les migrations ont deja ete appliquees plus tot" -ForegroundColor Gray
    Write-Host "   2. Les migrations sont en cours d'application" -ForegroundColor Gray
    Write-Host "   3. Les migrations s'appliqueront au prochain demarrage" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Etape 3: Verification de l'etat du service..." -ForegroundColor Yellow

$service = aws ecs describe-services `
    --cluster $CLUSTER_NAME `
    --services $SERVICE_NAME `
    --region $REGION `
    --query 'services[0]' `
    --output json | ConvertFrom-Json

Write-Host "Statut: $($service.status)" -ForegroundColor Gray
Write-Host "Taches en cours: $($service.runningCount)/$($service.desiredCount)" -ForegroundColor Gray
Write-Host ""

# Verifier les dernieres taches
if ($tasks) {
    Write-Host "Etape 4: Verification des dernieres taches..." -ForegroundColor Yellow
    
    foreach ($taskArn in $tasks) {
        $taskId = $taskArn -replace '.*/', ''
        Write-Host "Tache: $taskId" -ForegroundColor Gray
        
        $taskInfo = aws ecs describe-tasks `
            --cluster $CLUSTER_NAME `
            --tasks $taskArn `
            --region $REGION `
            --query 'tasks[0]' `
            --output json | ConvertFrom-Json
        
        if ($taskInfo) {
            $status = $taskInfo.lastStatus
            $createdAt = $taskInfo.createdAt
            Write-Host "   Statut: $status" -ForegroundColor Gray
            Write-Host "   Cree: $createdAt" -ForegroundColor Gray
            
            if ($taskInfo.containers[0].exitCode) {
                $exitCode = $taskInfo.containers[0].exitCode
                Write-Host "   Code de sortie: $exitCode" -ForegroundColor Gray
            }
        }
        Write-Host ""
    }
}

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Resume" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""
Write-Host "Pour verifier manuellement les migrations dans la base de donnees:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Via ECS Exec (si Session Manager Plugin installe):" -ForegroundColor White
Write-Host "   aws ecs execute-command --cluster $CLUSTER_NAME --task <TASK_ARN> --container backend --command `"psql `$DATABASE_URL -c `"SELECT column_name FROM information_schema.columns WHERE table_name = 'product_delivery_config' AND column_name IN ('preparation_time_minutes', 'storage_location_id');`"`" --interactive --region $REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Via AWS Console:" -ForegroundColor White
Write-Host "   - ECS Console -> Clusters -> $CLUSTER_NAME" -ForegroundColor Gray
Write-Host "   - Tasks -> Selectionner une tache -> Execute Command" -ForegroundColor Gray
Write-Host "   - Executer: psql `$DATABASE_URL -c `"SELECT column_name FROM information_schema.columns WHERE table_name = 'product_delivery_config';`"" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verifier les logs en temps reel:" -ForegroundColor White
Write-Host "   aws logs tail $LOG_GROUP --follow --region $REGION" -ForegroundColor Gray
Write-Host ""

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Termine!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



