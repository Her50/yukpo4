# Script pour generer un rapport final complet de l'etat de la base de donnees

param(
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rapport Final Complet - Base AWS" -ForegroundColor Cyan
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
$logGroupName = "/ecs/yukpomnang-sql-report-final"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Script SQL de rapport complet
$rapportSQL = @"
-- RAPPORT FINAL COMPLET DE LA BASE DE DONNEES
-- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

\echo '========================================'
\echo 'RAPPORT FINAL COMPLET'
\echo '========================================'
\echo ''

-- 1. MIGRATIONS
\echo '1. MIGRATIONS:'
\echo '-------------'
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN success THEN 1 END) as successful,
    COUNT(CASE WHEN NOT success THEN 1 END) as failed
FROM _sqlx_migrations;
\echo ''

-- 2. TABLES CRITIQUES
\echo '2. TABLES CRITIQUES:'
\echo '-------------------'
SELECT 
    table_name,
    CASE WHEN table_name IN ('users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations', 'deliveries', 'couriers', 'courier_profiles') 
         THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN (
    'users', 'services', 'media', 'user_saved_addresses',
    'autocomplete_characteristics', 'autocomplete_combinations',
    'service_products', 'products_lifecycle', 'service_reviews',
    'deliveries', 'couriers', 'courier_profiles', 'courier_applications',
    'courier_assets', 'delivery_parcels', 'parcel_types'
)
ORDER BY priority DESC, table_name;
\echo ''

-- 3. VUES CRITIQUES
\echo '3. VUES CRITIQUES:'
\echo '-----------------'
SELECT 
    viewname,
    CASE WHEN viewname IN ('delivery_requests') THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM pg_views 
WHERE schemaname = 'public'
AND viewname IN ('delivery_requests')
ORDER BY priority DESC, viewname;
\echo ''

-- 4. FONCTIONS CRITIQUES
\echo '4. FONCTIONS CRITIQUES:'
\echo '----------------------'
SELECT 
    proname,
    CASE WHEN proname IN ('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized', 'refresh_services_search_optimized') 
         THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname IN ('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized', 'refresh_services_search_optimized')
ORDER BY priority DESC, proname;
\echo ''

-- 5. INDEX CRITIQUES
\echo '5. INDEX CRITIQUES:'
\echo '------------------'
SELECT 
    indexname,
    tablename,
    CASE WHEN indexname IN ('idx_user_saved_addresses_user_id', 'idx_services_search_optimized_v2_unique') 
         THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM pg_indexes 
WHERE schemaname = 'public'
AND (
    indexname LIKE 'idx_user_saved_addresses%' 
    OR indexname = 'idx_services_search_optimized_v2_unique'
    OR (tablename = 'courier_profiles' AND indexname LIKE 'idx_courier_profiles%')
)
ORDER BY priority DESC, tablename, indexname;
\echo ''

-- 6. VUES MATERIALISEES
\echo '6. VUES MATERIALISEES:'
\echo '----------------------'
SELECT 
    matviewname,
    CASE WHEN matviewname = 'services_search_optimized_v2' THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM pg_matviews 
WHERE schemaname = 'public'
AND matviewname = 'services_search_optimized_v2';
\echo ''

-- 7. STATISTIQUES
\echo '7. STATISTIQUES:'
\echo '---------------'
SELECT 'Tables' as type, COUNT(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'Vues', COUNT(*)::text FROM pg_views WHERE schemaname = 'public'
UNION ALL
SELECT 'Vues materialisees', COUNT(*)::text FROM pg_matviews WHERE schemaname = 'public'
UNION ALL
SELECT 'Fonctions', COUNT(*)::text FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT 'Index', COUNT(*)::text FROM pg_indexes WHERE schemaname = 'public';
\echo ''

\echo '========================================'
\echo 'FIN DU RAPPORT'
\echo '========================================'
"@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($rapportSQL))

# Creer la commande
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-final-report"
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
                    "awslogs-stream-prefix" = "final"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    Write-Host "Generation du rapport final..." -ForegroundColor Yellow
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
        Write-Host "Recuperation du rapport..." -ForegroundColor Cyan
        Write-Host ""
        
        $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
        
        if ($logs) {
            # Sauvegarder le rapport
            $rapportFile = "rapport_final_base_aws_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
            $logs | Out-File -FilePath $rapportFile -Encoding UTF8
            
            Write-Host "Rapport sauvegarde dans: $rapportFile" -ForegroundColor Green
            Write-Host ""
            Write-Host "Apercu du rapport:" -ForegroundColor Cyan
            Write-Host "==================" -ForegroundColor Cyan
            Write-Host ""
            
            # Afficher les resultats importants
            $logs -split "`n" | ForEach-Object {
                $line = $_
                if ($line -match 'MIGRATIONS|TABLES|VUES|FONCTIONS|INDEX|STATISTIQUES|RAPPORT') {
                    Write-Host $line -ForegroundColor Yellow
                } elseif ($line -match 'CRITICAL|✅|exists.*true') {
                    Write-Host $line -ForegroundColor Green
                } elseif ($line -match 'MANQUANT|❌|exists.*false|failed') {
                    Write-Host $line -ForegroundColor Red
                } elseif ($line -match '^\s*\d+') {
                    Write-Host $line -ForegroundColor Gray
                } else {
                    Write-Host $line -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "Aucun log disponible. Verifiez manuellement:" -ForegroundColor Yellow
            Write-Host "   aws logs tail $logGroupName --region $Region --since 5m" -ForegroundColor Gray
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

Write-Host ""



