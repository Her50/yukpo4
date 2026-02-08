# Script pour comparer les migrations locales avec l'etat de la base AWS
# Liste toutes les migrations et verifie leur etat

param(
    [string]$Region = "us-east-1",
    [string]$MigrationsPath = "backend/migrations"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Comparaison Migrations Locales vs Base AWS" -ForegroundColor Cyan
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
$logGroupName = "/ecs/yukpomnang-sql-check"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# 1. Lister toutes les migrations locales
Write-Host "1. Analyse des migrations locales..." -ForegroundColor Cyan
$migrationFiles = Get-ChildItem -Path $MigrationsPath -Filter "*.sql" | Sort-Object Name
Write-Host "   Total de fichiers de migration: $($migrationFiles.Count)" -ForegroundColor Gray
Write-Host ""

# 2. Verifier les migrations dans la base
Write-Host "2. Verification des migrations dans la base AWS..." -ForegroundColor Cyan

$checkMigrationsSQL = "SELECT version, description FROM _sqlx_migrations WHERE success = true ORDER BY version;"
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($checkMigrationsSQL))
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A"

$taskDefJson = @{
    family = "yukpomnang-check-migrations"
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
                    "awslogs-stream-prefix" = "migrations"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    $taskDefArn = aws ecs register-task-definition `
        --cli-input-json "file://$taskDefFile" `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskDefArn -notmatch "error") {
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
            Write-Host "   Attente de l'execution..." -ForegroundColor Yellow
            Start-Sleep -Seconds 15
            
            $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
            
            if ($logs) {
                $appliedMigrations = $logs -split "`n" | Where-Object { $_ -match '^\d+' } | ForEach-Object { ($_ -split '\|')[0].Trim() }
                Write-Host "   Migrations appliquees dans la base: $($appliedMigrations.Count)" -ForegroundColor Gray
            }
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

# 3. Verifier les tables critiques
Write-Host ""
Write-Host "3. Verification des tables critiques..." -ForegroundColor Cyan

$checkTablesSQL = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN (
    'users', 'services', 'media', 'user_saved_addresses',
    'autocomplete_characteristics', 'autocomplete_combinations',
    'service_products', 'products_lifecycle', 'service_reviews',
    'deliveries', 'delivery_requests', 'courier_profiles'
)
ORDER BY table_name;
"@

$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($checkTablesSQL))
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A"

$taskDefJson = @{
    family = "yukpomnang-check-tables"
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
                    "awslogs-stream-prefix" = "tables"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    $taskDefArn = aws ecs register-task-definition `
        --cli-input-json "file://$taskDefFile" `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskDefArn -notmatch "error") {
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
            Start-Sleep -Seconds 15
            
            $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
            
            if ($logs) {
                $existingTables = $logs -split "`n" | Where-Object { $_ -match '^\w+' } | ForEach-Object { $_.Trim() }
                
                $criticalTables = @('users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations', 'service_products')
                foreach ($table in $criticalTables) {
                    if ($existingTables -contains $table) {
                        Write-Host "   ✅ Table $table existe" -ForegroundColor Green
                    } else {
                        Write-Host "   ❌ Table $table MANQUANTE" -ForegroundColor Red
                    }
                }
            }
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

# 4. Verifier les fonctions et index
Write-Host ""
Write-Host "4. Verification des fonctions et index..." -ForegroundColor Cyan

$checkFunctionsSQL = @"
SELECT proname FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname IN ('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized')
ORDER BY proname;
"@

$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($checkFunctionsSQL))
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A"

$taskDefJson = @{
    family = "yukpomnang-check-functions"
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
                    "awslogs-stream-prefix" = "functions"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    $taskDefArn = aws ecs register-task-definition `
        --cli-input-json "file://$taskDefFile" `
        --region $Region `
        --query 'taskDefinition.taskDefinitionArn' `
        --output text `
        2>&1
    
    if ($LASTEXITCODE -eq 0 -and $taskDefArn -notmatch "error") {
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
            Start-Sleep -Seconds 15
            
            $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
            
            if ($logs) {
                $existingFunctions = $logs -split "`n" | Where-Object { $_ -match '^\w+' } | ForEach-Object { $_.Trim() }
                
                $criticalFunctions = @('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized')
                foreach ($func in $criticalFunctions) {
                    if ($existingFunctions -contains $func) {
                        Write-Host "   ✅ Fonction $func existe" -ForegroundColor Green
                    } else {
                        Write-Host "   ❌ Fonction $func MANQUANTE" -ForegroundColor Red
                    }
                }
            }
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification terminee" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour voir les logs complets:" -ForegroundColor Yellow
Write-Host "   aws logs tail $logGroupName --region $Region --since 5m" -ForegroundColor Gray
Write-Host ""



