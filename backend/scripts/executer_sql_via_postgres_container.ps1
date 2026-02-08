# Script pour executer le script SQL via un conteneur PostgreSQL temporaire
# Cette approche evite les problemes avec les secrets SSM

param(
    [string]$ClusterName = "yukpomnang-cluster",
    [string]$Region = "us-east-1",
    [string]$DatabaseUrl = "postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require",
    [string]$ScriptPath = "backend/migrations/20260207_fix_all_missing_tables_and_functions.sql"
)

Write-Host "Execution du script SQL via conteneur PostgreSQL temporaire" -ForegroundColor Cyan
Write-Host ""

# Verifier que le script SQL existe
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERREUR: Script SQL non trouve: $ScriptPath" -ForegroundColor Red
    exit 1
}

# Lire le script SQL
$scriptContent = Get-Content $ScriptPath -Raw -Encoding UTF8
Write-Host "Script SQL trouve: $ScriptPath ($($scriptContent.Length) caracteres)" -ForegroundColor Green

# Configuration reseau
$subnets = "subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
$securityGroups = "sg-0f9210abfa33d52d4"
$networkConfig = "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=ENABLED}"

# Encoder le script SQL en base64
$scriptBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($scriptContent))

# Extraire les informations de connexion
# Le format est: postgresql://user:password@host:port/db?sslmode=require
if ($DatabaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
} else {
    Write-Host "ERREUR: Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

# Encoder la DATABASE_URL en base64 pour la passer securisee
$databaseUrlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($DatabaseUrl))

# Creer la commande qui sera executee dans le conteneur
# Utiliser l'image postgres:15 qui a psql
# Decoder DATABASE_URL et l'utiliser directement
$command = "export DATABASE_URL=`$(printf '%s' '$databaseUrlBase64' | base64 -d) && printf '%s' '$scriptBase64' | base64 -d | psql `$DATABASE_URL"

Write-Host "Lancement du conteneur PostgreSQL temporaire..." -ForegroundColor Yellow
Write-Host ""

# Recuperer le role d'execution depuis une definition de tache existante
Write-Host "Recuperation du role d'execution..." -ForegroundColor Yellow
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

Write-Host "Role d'execution: $executionRoleArn" -ForegroundColor Gray
Write-Host ""

# Creer une definition de tache temporaire
$taskDefinitionJson = @{
    family = "yukpomnang-sql-execution-temp"
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
            command = @("sh", "-c", $command)
            environment = @()
            logConfiguration = @{
                logDriver = "awslogs"
                options = @{
                    "awslogs-group" = "/ecs/yukpomnang-sql-execution"
                    "awslogs-region" = $Region
                    "awslogs-stream-prefix" = "ecs"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

# Creer le groupe de logs si necessaire
$logGroupName = "/ecs/yukpomnang-sql-execution"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    Write-Host "Creation du groupe de logs..." -ForegroundColor Yellow
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}
Write-Host "Groupe de logs: $logGroupName" -ForegroundColor Gray
Write-Host ""

# Enregistrer la definition de tache
$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefinitionJson, [System.Text.UTF8Encoding]::new($false))

try {
    Write-Host "Enregistrement de la definition de tache..." -ForegroundColor Yellow
    $taskDefResult = aws ecs register-task-definition `
        --cli-input-json "file://$taskDefFile" `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskDefResult -notmatch "error") {
        $taskDefArn = $taskDefResult.Trim()
        Write-Host "Definition de tache creee: $taskDefArn" -ForegroundColor Green
        Write-Host ""
        
        # Lancer la tache
        Write-Host "Lancement de la tache..." -ForegroundColor Yellow
        $taskOutput = aws ecs run-task `
            --cluster $ClusterName `
            --task-definition $taskDefArn `
            --launch-type FARGATE `
            --network-configuration $networkConfig `
            --region $Region `
            --query 'tasks[0].taskArn' `
            --output text `
            2>&1
        
        if ($LASTEXITCODE -eq 0 -and $taskOutput -notmatch "error" -and $taskOutput.Length -gt 0) {
            $taskArn = $taskOutput.Trim()
            Write-Host "✅ Tache lancee: $taskArn" -ForegroundColor Green
            Write-Host ""
            Write-Host "Attente de l'execution (peut prendre 1-2 minutes)..." -ForegroundColor Yellow
            Write-Host ""
            
            # Attendre que la tache se termine
            $maxWaitTime = 300
            $elapsedTime = 0
            $checkInterval = 5
            
            while ($elapsedTime -lt $maxWaitTime) {
                Start-Sleep -Seconds $checkInterval
                $elapsedTime += $checkInterval
                
                $taskStatus = aws ecs describe-tasks `
                    --cluster $ClusterName `
                    --tasks $taskArn `
                    --region $Region `
                    --query 'tasks[0].lastStatus' `
                    --output text `
                    2>&1
                
                if ($taskStatus -eq "STOPPED") {
                    Write-Host "✅ Tache terminee!" -ForegroundColor Green
                    Write-Host ""
                    
                    # Recuperer le code de sortie et les logs
                    $taskDetails = aws ecs describe-tasks `
                        --cluster $ClusterName `
                        --tasks $taskArn `
                        --region $Region `
                        --query 'tasks[0]' `
                        | ConvertFrom-Json
                    
                    $exitCode = $taskDetails.containers[0].exitCode
                    
                    if ($exitCode -eq 0) {
                        Write-Host "✅ Script SQL execute avec succes!" -ForegroundColor Green
                    } else {
                        Write-Host "❌ Le script SQL a echoue (code de sortie: $exitCode)" -ForegroundColor Red
                        Write-Host "Raison: $($taskDetails.containers[0].reason)" -ForegroundColor Yellow
                    }
                    
                    Write-Host ""
                    Write-Host "Pour voir les logs complets:" -ForegroundColor Cyan
                    Write-Host "   aws logs tail /ecs/yukpomnang-sql-execution --region $Region --follow" -ForegroundColor Gray
                    
                    exit [int]$exitCode
                }
                
                Write-Host "   Statut: $taskStatus (attente: ${elapsedTime}s)" -ForegroundColor Gray
            }
            
            Write-Host "⏰ Timeout: La tache prend plus de temps que prevu" -ForegroundColor Yellow
        } else {
            Write-Host "❌ ERREUR lors du lancement de la tache:" -ForegroundColor Red
            Write-Host $taskOutput -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ ERREUR lors de la creation de la definition de tache:" -ForegroundColor Red
        Write-Host $taskDefResult -ForegroundColor Red
        exit 1
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

