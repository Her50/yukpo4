# Script complet pour verifier toutes les migrations, tables et index dans la base PostgreSQL AWS

param(
    [string]$Region = "us-east-1",
    [string]$MigrationsPath = "backend/migrations"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete des Migrations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Recuperer DATABASE_URL depuis SSM
$ssmPath = "/yukpomnang/production/DATABASE_URL"
Write-Host "Recuperation de DATABASE_URL depuis SSM..." -ForegroundColor Yellow
$databaseUrl = aws ssm get-parameter --name $ssmPath --region $Region --with-decryption --query Parameter.Value --output text 2>&1

if ($LASTEXITCODE -ne 0 -or -not $databaseUrl -or $databaseUrl -match "error") {
    Write-Host "ERREUR: Impossible de recuperer DATABASE_URL depuis SSM" -ForegroundColor Red
    exit 1
}

$databaseUrl = $databaseUrl.Trim()
Write-Host "✅ DATABASE_URL recuperee" -ForegroundColor Green
Write-Host ""

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
$logGroupName = "/ecs/yukpomnang-sql-verification"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Fonction pour executer une requete SQL
function Execute-SQLQuery {
    param([string]$sqlQuery, [string]$description)
    
    $sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($sqlQuery))
    $bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A"
    
    $taskDefJson = @{
        family = "yukpomnang-sql-query-temp"
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
                        "awslogs-stream-prefix" = "query"
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
        
        if ($LASTEXITCODE -ne 0 -or $taskDefArn -match "error") {
            return $null
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
            Start-Sleep -Seconds 15
            $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
            return $logs
        }
    } finally {
        Remove-Item $taskDefFile -ErrorAction SilentlyContinue
    }
    
    return $null
}

# 1. Lister toutes les migrations locales
Write-Host "1. Analyse des migrations locales..." -ForegroundColor Cyan
$migrationFiles = Get-ChildItem -Path $MigrationsPath -Filter "*.sql" | Sort-Object Name
Write-Host "   Nombre de fichiers de migration: $($migrationFiles.Count)" -ForegroundColor Gray
Write-Host ""

# 2. Verifier les migrations appliquees dans la base
Write-Host "2. Verification des migrations appliquees dans la base..." -ForegroundColor Cyan
$checkMigrationsSQL = "SELECT version, description, installed_on, success FROM _sqlx_migrations ORDER BY version;"
$migrationsResult = Execute-SQLQuery -sqlQuery $checkMigrationsSQL -description "Verification migrations"

if ($migrationsResult) {
    $migrationsLines = $migrationsResult -split "`n" | Where-Object { $_ -match '\d+' }
    Write-Host "   Migrations trouvees dans la base: $($migrationsLines.Count)" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️ Impossible de recuperer les migrations depuis la base" -ForegroundColor Yellow
}

Write-Host ""

# 3. Verifier les tables principales
Write-Host "3. Verification des tables principales..." -ForegroundColor Cyan
$checkTablesSQL = @"
SELECT 
    table_name,
    CASE WHEN table_name IN (
        'users', 'services', 'media', 'autocomplete_characteristics', 
        'autocomplete_combinations', 'service_products', 'products_lifecycle',
        'service_reviews', 'product_reactions', 'product_comments',
        'user_saved_addresses', 'deliveries', 'delivery_requests',
        'courier_profiles', 'courier_assets', 'delivery_ratings'
    ) THEN '✅' ELSE '⚠️' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@

$tablesResult = Execute-SQLQuery -sqlQuery $checkTablesSQL -description "Verification tables"

if ($tablesResult) {
    $tablesLines = $tablesResult -split "`n" | Where-Object { $_ -match '\w+' }
    Write-Host "   Tables trouvees: $($tablesLines.Count)" -ForegroundColor Gray
    
    # Verifier les tables critiques
    $criticalTables = @('users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations')
    foreach ($table in $criticalTables) {
        if ($tablesResult -match $table) {
            Write-Host "   ✅ Table $table existe" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Table $table MANQUANTE" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠️ Impossible de recuperer les tables depuis la base" -ForegroundColor Yellow
}

Write-Host ""

# 4. Verifier les fonctions
Write-Host "4. Verification des fonctions..." -ForegroundColor Cyan
$checkFunctionsSQL = @"
SELECT 
    proname as function_name,
    CASE WHEN proname IN (
        'calculate_best_vector_match_score', 
        'product_combination_exists',
        'calculate_vector_match_score_optimized',
        'refresh_services_search_optimized'
    ) THEN '✅' ELSE '⚠️' END as status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
"@

$functionsResult = Execute-SQLQuery -sqlQuery $checkFunctionsSQL -description "Verification fonctions"

if ($functionsResult) {
    $functionsLines = $functionsResult -split "`n" | Where-Object { $_ -match '\w+' }
    Write-Host "   Fonctions trouvees: $($functionsLines.Count)" -ForegroundColor Gray
    
    # Verifier les fonctions critiques
    $criticalFunctions = @('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized')
    foreach ($func in $criticalFunctions) {
        if ($functionsResult -match $func) {
            Write-Host "   ✅ Fonction $func existe" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Fonction $func MANQUANTE" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠️ Impossible de recuperer les fonctions depuis la base" -ForegroundColor Yellow
}

Write-Host ""

# 5. Verifier les index critiques
Write-Host "5. Verification des index critiques..." -ForegroundColor Cyan
$checkIndexesSQL = @"
SELECT 
    indexname,
    tablename,
    CASE WHEN indexname IN (
        'idx_user_saved_addresses_user_id',
        'idx_services_search_optimized_v2_unique',
        'idx_autocomplete_characteristics_characteristic_vector_gin',
        'idx_autocomplete_combinations_product_vector_gin'
    ) THEN '✅' ELSE '⚠️' END as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname IN (
    'idx_user_saved_addresses_user_id',
    'idx_services_search_optimized_v2_unique',
    'idx_autocomplete_characteristics_characteristic_vector_gin',
    'idx_autocomplete_combinations_product_vector_gin'
)
ORDER BY tablename, indexname;
"@

$indexesResult = Execute-SQLQuery -sqlQuery $checkIndexesSQL -description "Verification index"

if ($indexesResult) {
    $indexesLines = $indexesResult -split "`n" | Where-Object { $_ -match '\w+' }
    Write-Host "   Index critiques verifies: $($indexesLines.Count)" -ForegroundColor Gray
    
    # Verifier les index critiques
    $criticalIndexes = @(
        'idx_user_saved_addresses_user_id',
        'idx_services_search_optimized_v2_unique'
    )
    foreach ($idx in $criticalIndexes) {
        if ($indexesResult -match $idx) {
            Write-Host "   ✅ Index $idx existe" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Index $idx MANQUANT" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⚠️ Impossible de recuperer les index depuis la base" -ForegroundColor Yellow
}

Write-Host ""

# 6. Verifier la vue materialisee
Write-Host "6. Verification de la vue materialisee..." -ForegroundColor Cyan
$checkViewSQL = @"
SELECT 
    matviewname,
    CASE WHEN matviewname = 'services_search_optimized_v2' THEN '✅' ELSE '⚠️' END as status
FROM pg_matviews 
WHERE schemaname = 'public';
"@

$viewResult = Execute-SQLQuery -sqlQuery $checkViewSQL -description "Verification vue materialisee"

if ($viewResult -match 'services_search_optimized_v2') {
    Write-Host "   ✅ Vue materialisee services_search_optimized_v2 existe" -ForegroundColor Green
} else {
    Write-Host "   ❌ Vue materialisee services_search_optimized_v2 MANQUANTE" -ForegroundColor Red
}

Write-Host ""

# Resume final
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resume de la verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour voir les details complets, consultez les logs CloudWatch:" -ForegroundColor Yellow
Write-Host "   aws logs tail $logGroupName --region $Region --since 10m" -ForegroundColor Gray
Write-Host ""



