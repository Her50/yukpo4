# Script de verification finale simple - execute toutes les verifications en une seule requete

param(
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Finale Complete" -ForegroundColor Cyan
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
$logGroupName = "/ecs/yukpomnang-verification-final"
$logGroupExists = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region --query "logGroups[?logGroupName=='$logGroupName'].logGroupName" --output text 2>&1
if (-not $logGroupExists -or $logGroupExists -match "error" -or $logGroupExists -eq "") {
    aws logs create-log-group --log-group-name $logGroupName --region $Region 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}

# Script SQL de verification complete
$verificationSQL = @"
-- VERIFICATION COMPLETE
SELECT 'MIGRATIONS' as section, 
       COUNT(*)::text as total,
       COUNT(CASE WHEN success THEN 1 END)::text as successful,
       COUNT(CASE WHEN NOT success THEN 1 END)::text as failed
FROM _sqlx_migrations
UNION ALL
SELECT 'TABLES_CRITICAL', 
       COUNT(*)::text,
       NULL,
       NULL
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN ('users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations', 'deliveries', 'couriers', 'courier_profiles')
UNION ALL
SELECT 'TABLES_MISSING',
       string_agg(table_name, ', '),
       NULL,
       NULL
FROM (
    SELECT unnest(ARRAY['users', 'services', 'user_saved_addresses', 'autocomplete_characteristics', 'autocomplete_combinations', 'deliveries', 'couriers', 'courier_profiles']) as table_name
) expected
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = expected.table_name
)
UNION ALL
SELECT 'VIEWS_CRITICAL',
       COUNT(*)::text,
       NULL,
       NULL
FROM pg_views 
WHERE schemaname = 'public' AND viewname = 'delivery_requests'
UNION ALL
SELECT 'FUNCTIONS_CRITICAL',
       COUNT(*)::text,
       NULL,
       NULL
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname IN ('calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized', 'refresh_services_search_optimized')
UNION ALL
SELECT 'FUNCTIONS_MISSING',
       string_agg(func_name, ', '),
       NULL,
       NULL
FROM (
    SELECT unnest(ARRAY['calculate_best_vector_match_score', 'product_combination_exists', 'calculate_vector_match_score_optimized', 'refresh_services_search_optimized']) as func_name
) expected
WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND p.proname = expected.func_name
)
UNION ALL
SELECT 'INDEXES_CRITICAL',
       COUNT(*)::text,
       NULL,
       NULL
FROM pg_indexes 
WHERE schemaname = 'public'
AND (
    (tablename = 'user_saved_addresses' AND indexname LIKE 'idx_user_saved_addresses%')
    OR indexname = 'idx_services_search_optimized_v2_unique'
)
UNION ALL
SELECT 'MATVIEW_EXISTS',
       CASE WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN 'YES' ELSE 'NO' END,
       NULL,
       NULL;
"@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($verificationSQL))

# Creer la commande
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -A -F '|'"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-verif-simple"
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
                    "awslogs-stream-prefix" = "simple"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

$taskDefFile = [System.IO.Path]::GetTempFileName() -replace '\.tmp$','.json'
[System.IO.File]::WriteAllText($taskDefFile, $taskDefJson, [System.Text.UTF8Encoding]::new($false))

try {
    Write-Host "Execution de la verification..." -ForegroundColor Yellow
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
        Write-Host "Attente de l'execution (35 secondes)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 35
        
        Write-Host ""
        Write-Host "Resultats de la verification:" -ForegroundColor Cyan
        Write-Host "=============================" -ForegroundColor Cyan
        Write-Host ""
        
        # Recuperer les logs
        $logs = aws logs tail $logGroupName --region $Region --since 3m --format short 2>&1
        
        if ($logs) {
            # Parser et afficher les resultats
            $results = @{}
            $logs -split "`n" | Where-Object { $_ -match '\|' } | ForEach-Object {
                $parts = $_ -split '\|'
                if ($parts.Length -ge 2) {
                    $section = $parts[0].Trim()
                    $value = $parts[1].Trim()
                    $results[$section] = $value
                }
            }
            
            # Afficher les resultats formates
            if ($results.ContainsKey('MIGRATIONS')) {
                Write-Host "MIGRATIONS:" -ForegroundColor Yellow
                $migParts = $results['MIGRATIONS'] -split ','
                Write-Host "  Total: $($migParts[0])" -ForegroundColor Gray
                Write-Host "  Reussies: $($migParts[1])" -ForegroundColor Green
                Write-Host "  Echouees: $($migParts[2])" -ForegroundColor $(if ([int]$migParts[2] -gt 0) { "Red" } else { "Gray" })
                Write-Host ""
            }
            
            if ($results.ContainsKey('TABLES_CRITICAL')) {
                Write-Host "TABLES CRITIQUES:" -ForegroundColor Yellow
                Write-Host "  Presentes: $($results['TABLES_CRITICAL'])" -ForegroundColor Green
                if ($results.ContainsKey('TABLES_MISSING') -and $results['TABLES_MISSING'] -ne '') {
                    Write-Host "  Manquantes: $($results['TABLES_MISSING'])" -ForegroundColor Red
                } else {
                    Write-Host "  Toutes les tables critiques existent" -ForegroundColor Green
                }
                Write-Host ""
            }
            
            if ($results.ContainsKey('VIEWS_CRITICAL')) {
                Write-Host "VUES CRITIQUES:" -ForegroundColor Yellow
                if ([int]$results['VIEWS_CRITICAL'] -gt 0) {
                    Write-Host "  ✅ Vue delivery_requests existe" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ Vue delivery_requests MANQUANTE" -ForegroundColor Red
                }
                Write-Host ""
            }
            
            if ($results.ContainsKey('FUNCTIONS_CRITICAL')) {
                Write-Host "FONCTIONS CRITIQUES:" -ForegroundColor Yellow
                Write-Host "  Presentes: $($results['FUNCTIONS_CRITICAL'])" -ForegroundColor Green
                if ($results.ContainsKey('FUNCTIONS_MISSING') -and $results['FUNCTIONS_MISSING'] -ne '') {
                    Write-Host "  Manquantes: $($results['FUNCTIONS_MISSING'])" -ForegroundColor Red
                } else {
                    Write-Host "  Toutes les fonctions critiques existent" -ForegroundColor Green
                }
                Write-Host ""
            }
            
            if ($results.ContainsKey('INDEXES_CRITICAL')) {
                Write-Host "INDEX CRITIQUES:" -ForegroundColor Yellow
                Write-Host "  Present: $($results['INDEXES_CRITICAL'])" -ForegroundColor Green
                Write-Host ""
            }
            
            if ($results.ContainsKey('MATVIEW_EXISTS')) {
                Write-Host "VUE MATERIALISEE:" -ForegroundColor Yellow
                if ($results['MATVIEW_EXISTS'] -eq 'YES') {
                    Write-Host "  ✅ services_search_optimized_v2 existe" -ForegroundColor Green
                } else {
                    Write-Host "  ❌ services_search_optimized_v2 MANQUANTE" -ForegroundColor Red
                }
                Write-Host ""
            }
            
            # Sauvegarder le rapport
            $rapportFile = "verification_finale_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
            $logs | Out-File -FilePath $rapportFile -Encoding UTF8
            Write-Host "Rapport complet sauvegarde dans: $rapportFile" -ForegroundColor Cyan
        } else {
            Write-Host "Aucun resultat recupere. Verifiez les logs:" -ForegroundColor Yellow
            Write-Host "   aws logs tail $logGroupName --region $Region --since 5m" -ForegroundColor Gray
        }
    }
} finally {
    Remove-Item $taskDefFile -ErrorAction SilentlyContinue
}

Write-Host ""



