# Script pour executer une migration SQL via conteneur PostgreSQL

param(
    [Parameter(Mandatory=$true)]
    [string]$ScriptPath,
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Execution de la migration SQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que le fichier existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERREUR: Fichier SQL non trouve: $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier: $ScriptPath" -ForegroundColor Yellow
Write-Host ""

# Recuperer DATABASE_URL depuis SSM
$ssmPath = "/yukpomnang/production/DATABASE_URL"
$databaseUrl = aws ssm get-parameter --name $ssmPath --region $Region --with-decryption --query Parameter.Value --output text 2>&1

if ($LASTEXITCODE -ne 0 -or -not $databaseUrl -or $databaseUrl -match "error") {
    Write-Host "ERREUR: Impossible de recuperer DATABASE_URL depuis SSM" -ForegroundColor Red
    exit 1
}

$databaseUrl = $databaseUrl.Trim()

# Extraire les informations de connexion
if ($databaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
} else {
    Write-Host "ERREUR: Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

# Configuration reseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"
$networkConfig = "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=ENABLED}"

# Recuperer le role d'execution
$executionRoleArn = aws ecs describe-task-definition `
    --task-definition yukpomnang-backend:3 `
    --region $Region `
    --query 'taskDefinition.executionRoleArn' `
    --output text `
    2>&1

if ($LASTEXITCODE -ne 0 -or -not $executionRoleArn -or $executionRoleArn -match "error") {
    Write-Host "ERREUR: Impossible de recuperer le role d'execution" -ForegroundColor Red
    exit 1
}

# Creer le groupe de logs
$logGroupName = "/ecs/yukpomnang-sql-execution"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Lire le fichier SQL
$sqlContent = Get-Content $ScriptPath -Raw -Encoding UTF8

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlContent))

# Creer la commande bash
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-migration-exec"
    networkMode = "awsvpc"
    requiresCompatibilities = @("FARGATE")
    cpu = "256"
    memory = "512"
    executionRoleArn = $executionRoleArn
    containerDefinitions = @(
        @{
            name = "postgres-client"
            image = "postgres:15"
            essential = $true
            command = @("sh", "-c", $bashCommand)
            logConfiguration = @{
                logDriver = "awslogs"
                options = @{
                    "awslogs-group" = $logGroupName
                    "awslogs-region" = $Region
                    "awslogs-stream-prefix" = "migration"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    Write-Host "Lancement de la tache ECS..." -ForegroundColor Yellow
    
    $taskDefArn = aws ecs register-task-definition `
        --cli-input-json "file://$taskDefFile" `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -ne 0 -or $taskDefArn -match "error") {
        Write-Host "ERREUR lors de la creation de la definition de tache: $taskDefArn" -ForegroundColor Red
        exit 1
    }
    
    $taskArn = aws ecs run-task `
        --cluster $ClusterName `
        --task-definition $taskDefArn `
        --launch-type FARGATE `
        --network-configuration $networkConfig `
        --region $Region `
        --query 'tasks[0].taskArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskArn -notmatch "error" -and $taskArn.Length -gt 0) {
        Write-Host "✅ Tache lancee: $taskArn" -ForegroundColor Green
        Write-Host "Attente de l'execution (40 secondes)..." -ForegroundColor Yellow
        
        $maxWait = 120
        $elapsed = 0
        while ($elapsed -lt $maxWait) {
            Start-Sleep -Seconds 5
            $elapsed += 5
            $status = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --query 'tasks[0].lastStatus' --output text 2>&1
            if ($status -eq "STOPPED") {
                $taskDetails = aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region --query 'tasks[0]' | ConvertFrom-Json
                $exitCode = $taskDetails.containers[0].exitCode
                
                Write-Host ""
                if ($exitCode -eq 0) {
                    Write-Host "✅ Migration executee avec succes!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Recuperation des logs..." -ForegroundColor Cyan
                    $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
                    if ($logs) {
                        $logs | Select-Object -Last 30
                    }
                } else {
                    Write-Host "❌ Erreur lors de l'execution (code: $exitCode)" -ForegroundColor Red
                    Write-Host "Raison: $($taskDetails.containers[0].reason)" -ForegroundColor Yellow
                    Write-Host ""
                    Write-Host "Logs:" -ForegroundColor Cyan
                    $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
                    if ($logs) {
                        $logs | Select-Object -Last 30
                    }
                }
                break
            }
        }
        
        if ($elapsed -ge $maxWait) {
            Write-Host "⏰ Timeout - La tache prend plus de temps que prevu" -ForegroundColor Yellow
            Write-Host "Verifiez manuellement: aws ecs describe-tasks --cluster $ClusterName --tasks $taskArn --region $Region" -ForegroundColor Gray
        }
    } else {
        Write-Host "ERREUR lors du lancement de la tache: $taskArn" -ForegroundColor Red
        exit 1
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

Write-Host ""



