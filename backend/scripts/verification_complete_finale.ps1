# Script final de verification complete - sauvegarde les resultats dans un fichier

param(
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete Finale" -ForegroundColor Cyan
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
$logGroupName = "/ecs/yukpomnang-sql-final-check"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Script SQL de verification complete
$verificationSQL = @"
-- VERIFICATION COMPLETE DE LA BASE DE DONNEES AWS
-- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

-- 1. MIGRATIONS
SELECT 'MIGRATIONS' as section, 
       COUNT(*) as total,
       COUNT(CASE WHEN success THEN 1 END) as successful,
       COUNT(CASE WHEN NOT success THEN 1 END) as failed
FROM _sqlx_migrations;

-- 2. TABLES CRITIQUES
SELECT 'TABLES' as section, 
       table_name,
       CASE WHEN table_name IN ('users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations') 
            THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN ('users', 'services', 'media', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations', 'service_products', 'products_lifecycle', 'service_reviews', 'deliveries', 'delivery_requests', 'courier_profiles')
ORDER BY priority DESC, table_name;

-- 3. FONCTIONS CRITIQUES
SELECT 'FUNCTIONS' as section,
       proname as function_name,
       CASE WHEN proname IN ('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized') 
            THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname IN ('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized', 'refresh_services_search_optimized')
ORDER BY priority DESC, proname;

-- 4. INDEX CRITIQUES
SELECT 'INDEXES' as section,
       indexname,
       tablename,
       CASE WHEN indexname IN ('idx_user_saved_addresses_user_id', 'idx_services_search_optimized_v2_unique') 
            THEN 'CRITICAL' ELSE 'NORMAL' END as priority
FROM pg_indexes 
WHERE schemaname = 'public'
AND (indexname LIKE 'idx_user_saved_addresses%' OR indexname = 'idx_services_search_optimized_v2_unique')
ORDER BY priority DESC, tablename, indexname;

-- 5. VUES MATERIALISEES
SELECT 'MATERIALIZED_VIEWS' as section,
       matviewname,
       'CRITICAL' as priority
FROM pg_matviews 
WHERE schemaname = 'public'
AND matviewname = 'services_search_optimized_v2';

-- 6. STATISTIQUES GENERALES
SELECT 'STATISTICS' as section,
       'total_tables' as metric,
       COUNT(*)::text as value
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'STATISTICS' as section,
       'total_functions' as metric,
       COUNT(*)::text as value
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT 'STATISTICS' as section,
       'total_indexes' as metric,
       COUNT(*)::text as value
FROM pg_indexes 
WHERE schemaname = 'public';
"@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($verificationSQL))

# Creer la commande
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -F '|' > /tmp/verification_results.txt && cat /tmp/verification_results.txt"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-final-verification"
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
    Write-Host "Lancement de la verification complete..." -ForegroundColor Yellow
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
        Write-Host "Attente de l'execution (25 secondes)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 25
        
        # Recuperer les logs
        Write-Host ""
        Write-Host "Recuperation des resultats..." -ForegroundColor Cyan
        Write-Host ""
        
        # Utiliser --format json pour eviter les problemes d'encodage
        $logsJson = aws logs tail $logGroupName --region $Region --since 3m --format json 2>&1 | ConvertFrom-Json
        
        if ($logsJson) {
            $results = @()
            foreach ($event in $logsJson) {
                if ($event.message) {
                    $results += $event.message
                }
            }
            
            # Analyser les resultats
            $currentSection = ""
            $tablesFound = @()
            $functionsFound = @()
            $indexesFound = @()
            $migrationsInfo = $null
            
            foreach ($line in $results) {
                if ($line -match '^MIGRATIONS\|') {
                    $currentSection = "MIGRATIONS"
                    $parts = $line -split '\|'
                    if ($parts.Length -ge 4) {
                        $migrationsInfo = @{
                            total = $parts[1]
                            successful = $parts[2]
                            failed = $parts[3]
                        }
                    }
                } elseif ($line -match '^TABLES\|') {
                    $currentSection = "TABLES"
                    $parts = $line -split '\|'
                    if ($parts.Length -ge 2) {
                        $tablesFound += $parts[1].Trim()
                    }
                } elseif ($line -match '^FUNCTIONS\|') {
                    $currentSection = "FUNCTIONS"
                    $parts = $line -split '\|'
                    if ($parts.Length -ge 2) {
                        $functionsFound += $parts[1].Trim()
                    }
                } elseif ($line -match '^INDEXES\|') {
                    $currentSection = "INDEXES"
                    $parts = $line -split '\|'
                    if ($parts.Length -ge 2) {
                        $indexesFound += $parts[2].Trim() + "." + $parts[1].Trim()
                    }
                }
            }
            
            # Afficher les resultats
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "RESULTATS DE LA VERIFICATION" -ForegroundColor Cyan
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            
            if ($migrationsInfo) {
                Write-Host "MIGRATIONS:" -ForegroundColor Yellow
                Write-Host "  Total: $($migrationsInfo.total)" -ForegroundColor Gray
                Write-Host "  Reussies: $($migrationsInfo.successful)" -ForegroundColor Green
                Write-Host "  Echouees: $($migrationsInfo.failed)" -ForegroundColor $(if ([int]$migrationsInfo.failed -gt 0) { "Red" } else { "Gray" })
                Write-Host ""
            }
            
            Write-Host "TABLES CRITIQUES:" -ForegroundColor Yellow
            $criticalTables = @('users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations')
            foreach ($table in $criticalTables) {
                if ($tablesFound -contains $table) {
                    Write-Host "  ✅ $table" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ $table MANQUANTE" -ForegroundColor Red
                }
            }
            Write-Host ""
            
            Write-Host "FONCTIONS CRITIQUES:" -ForegroundColor Yellow
            $criticalFunctions = @('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized')
            foreach ($func in $criticalFunctions) {
                if ($functionsFound -contains $func) {
                    Write-Host "  ✅ $func" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ $func MANQUANTE" -ForegroundColor Red
                }
            }
            Write-Host ""
            
            Write-Host "INDEX CRITIQUES:" -ForegroundColor Yellow
            $criticalIndexes = @('user_saved_addresses.idx_user_saved_addresses_user_id', 'services_search_optimized_v2.idx_services_search_optimized_v2_unique')
            foreach ($idx in $criticalIndexes) {
                if ($indexesFound -contains $idx) {
                    Write-Host "  ✅ $idx" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ $idx MANQUANT" -ForegroundColor Red
                }
            }
            Write-Host ""
            
            # Sauvegarder les resultats complets
            $outputFile = "verification_base_aws_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
            $results | Out-File -FilePath $outputFile -Encoding UTF8
            Write-Host "Resultats complets sauvegardes dans: $outputFile" -ForegroundColor Cyan
        } else {
            Write-Host "Aucun resultat recupere. Verifiez les logs:" -ForegroundColor Yellow
            Write-Host "   aws logs tail $logGroupName --region $Region --since 5m" -ForegroundColor Gray
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

Write-Host ""



