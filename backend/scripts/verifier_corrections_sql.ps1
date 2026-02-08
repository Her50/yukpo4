# Script pour verifier que toutes les corrections SQL ont ete appliquees

param(
    [string]$Region = "us-east-1"
)

Write-Host "Verification des corrections SQL appliquees" -ForegroundColor Cyan
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
$logGroupName = "/ecs/yukpomnang-sql-execution"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Script SQL de verification
$verificationSQL = @"
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_saved_addresses') 
        THEN '✅ Table user_saved_addresses existe' 
        ELSE '❌ Table user_saved_addresses MANQUANTE' 
    END as table_status,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_best_vector_match_score') 
        THEN '✅ Fonction calculate_best_vector_match_score existe' 
        ELSE '❌ Fonction calculate_best_vector_match_score MANQUANTE' 
    END as func1_status,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'product_combination_exists') 
        THEN '✅ Fonction product_combination_exists existe' 
        ELSE '❌ Fonction product_combination_exists MANQUANTE' 
    END as func2_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services_search_optimized_v2' 
        AND indexname = 'idx_services_search_optimized_v2_unique'
    ) 
        THEN '✅ Index unique pour services_search_optimized_v2 existe' 
        ELSE '❌ Index unique pour services_search_optimized_v2 MANQUANT' 
    END as index_status;
"@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($verificationSQL))

# Creer la commande
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-sql-verification-temp"
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
                    "awslogs-stream-prefix" = "verification"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    # Enregistrer et lancer la tache
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
        Write-Host "Attente de l'execution..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        
        # Recuperer les logs
        $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
        
        if ($logs) {
            Write-Host ""
            Write-Host "Resultats de la verification:" -ForegroundColor Cyan
            Write-Host $logs -ForegroundColor Gray
        } else {
            Write-Host "Aucun log disponible" -ForegroundColor Yellow
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}



