# Script pour executer le rapport de verification et afficher les resultats

param(
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rapport de Verification Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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

# Creer le groupe de logs
$logGroupName = "/ecs/yukpomnang-sql-report"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Lire le script SQL
$sqlFile = "backend/scripts/rapport_verification_complete.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERREUR: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlContent))

# Creer la commande
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-verification-report"
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
                    "awslogs-stream-prefix" = "report"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    Write-Host "Execution du rapport de verification..." -ForegroundColor Yellow
    Write-Host ""
    
    $taskDefArn = aws ecs register-task-definition `
        --cli-input-json "file://$taskDefFile" `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -ne 0 -or $taskDefArn -match "error") {
        Write-Host "ERREUR lors de la creation de la definition de tache" -ForegroundColor Red
        exit 1
    }
    
    $taskArn = aws ecs run-task `
        --cluster yukpomnang-cluster `
        --task-definition $taskDefArn `
        --launch-type FARGATE `
        --network-configuration $networkConfig `
        --region $Region `
        --query 'tasks[0].taskArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskArn -notmatch "error" -and $taskArn.Length -gt 0) {
        Write-Host "Attente de l'execution (30 secondes)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
        
        Write-Host ""
        Write-Host "Recuperation des resultats depuis CloudWatch Logs..." -ForegroundColor Cyan
        Write-Host ""
        
        # Recuperer les logs
        $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
        
        if ($logs) {
            # Sauvegarder dans un fichier
            $outputFile = "rapport_verification_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
            $logs | Out-File -FilePath $outputFile -Encoding UTF8
            
            Write-Host "Rapport sauvegarde dans: $outputFile" -ForegroundColor Green
            Write-Host ""
            Write-Host "Apercu du rapport:" -ForegroundColor Cyan
            Write-Host "==================" -ForegroundColor Cyan
            Write-Host ""
            
            # Afficher les lignes importantes
            $logs -split "`n" | Select-Object -First 50 | ForEach-Object {
                if ($_ -match 'migrations|tables|functions|indexes|materialized_views|statistics') {
                    Write-Host $_ -ForegroundColor Yellow
                } elseif ($_ -match 'exists.*true|successful|total') {
                    Write-Host $_ -ForegroundColor Green
                } elseif ($_ -match 'missing|failed|exists.*false') {
                    Write-Host $_ -ForegroundColor Red
                } else {
                    Write-Host $_ -ForegroundColor Gray
                }
            }
            
            Write-Host ""
            Write-Host "Pour voir le rapport complet:" -ForegroundColor Yellow
            Write-Host "   Get-Content $outputFile" -ForegroundColor Gray
        } else {
            Write-Host "Aucun log disponible. Verifiez manuellement:" -ForegroundColor Yellow
            Write-Host "   aws logs tail $logGroupName --region $Region --since 5m" -ForegroundColor Gray
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

Write-Host ""



