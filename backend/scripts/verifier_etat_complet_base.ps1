# Script complet pour verifier l'etat de la base de donnees AWS
# Verifie migrations, tables, index, fonctions, vues materialisees

param(
    [string]$Region = "us-east-1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete de la Base AWS" -ForegroundColor Cyan
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

# Script SQL complet de verification
$verificationSQL = @"
-- Verification complete de la base de donnees
\echo '========================================'
\echo 'VERIFICATION COMPLETE DE LA BASE'
\echo '========================================'
\echo ''

-- 1. Migrations appliquees
\echo '1. MIGRATIONS APPLIQUEES:'
\echo '-------------------------'
SELECT COUNT(*) as total_migrations, 
       COUNT(CASE WHEN success THEN 1 END) as successful,
       COUNT(CASE WHEN NOT success THEN 1 END) as failed
FROM _sqlx_migrations;
\echo ''

SELECT version, description, installed_on, 
       CASE WHEN success THEN '✅' ELSE '❌' END as status
FROM _sqlx_migrations 
ORDER BY version DESC 
LIMIT 20;
\echo ''

-- 2. Tables critiques
\echo '2. TABLES CRITIQUES:'
\echo '-------------------'
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') 
        THEN '✅ Table users existe' 
        ELSE '❌ Table users MANQUANTE' 
    END as users_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') 
        THEN '✅ Table services existe' 
        ELSE '❌ Table services MANQUANTE' 
    END as services_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_saved_addresses') 
        THEN '✅ Table user_saved_addresses existe' 
        ELSE '❌ Table user_saved_addresses MANQUANTE' 
    END as addresses_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'autocomplete_characteristics') 
        THEN '✅ Table autocomplete_characteristics existe' 
        ELSE '❌ Table autocomplete_characteristics MANQUANTE' 
    END as autochar_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'autocomplete_combinations') 
        THEN '✅ Table autocomplete_combinations existe' 
        ELSE '❌ Table autocomplete_combinations MANQUANTE' 
    END as autocombo_status;
\echo ''

-- 3. Fonctions critiques
\echo '3. FONCTIONS CRITIQUES:'
\echo '----------------------'
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_best_vector_match_score') 
        THEN '✅ Fonction calculate_best_vector_match_score existe' 
        ELSE '❌ Fonction calculate_best_vector_match_score MANQUANTE' 
    END as func1_status,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'product_combination_exists') 
        THEN '✅ Fonction product_combination_exists existe' 
        ELSE '❌ Fonction product_combination_exists MANQUANTE' 
    END as func2_status,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_vector_match_score_optimized') 
        THEN '✅ Fonction calculate_vector_match_score_optimized existe' 
        ELSE '❌ Fonction calculate_vector_match_score_optimized MANQUANTE' 
    END as func3_status;
\echo ''

-- 4. Index critiques
\echo '4. INDEX CRITIQUES:'
\echo '------------------'
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'user_saved_addresses' AND indexname = 'idx_user_saved_addresses_user_id') 
        THEN '✅ Index idx_user_saved_addresses_user_id existe' 
        ELSE '❌ Index idx_user_saved_addresses_user_id MANQUANT' 
    END as idx1_status,
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'services_search_optimized_v2' AND indexname = 'idx_services_search_optimized_v2_unique') 
        THEN '✅ Index idx_services_search_optimized_v2_unique existe' 
        ELSE '❌ Index idx_services_search_optimized_v2_unique MANQUANT' 
    END as idx2_status;
\echo ''

-- 5. Vue materialisee
\echo '5. VUE MATERIALISEE:'
\echo '-------------------'
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') 
        THEN '✅ Vue materialisee services_search_optimized_v2 existe' 
        ELSE '❌ Vue materialisee services_search_optimized_v2 MANQUANTE' 
    END as view_status;
\echo ''

-- 6. Nombre total de tables
\echo '6. STATISTIQUES:'
\echo '---------------'
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT COUNT(*) as total_functions FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';
\echo ''

\echo '========================================'
\echo 'FIN DE LA VERIFICATION'
\echo '========================================'
"@

# Encoder en base64
$sqlBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($verificationSQL))

# Creer la commande
$bashCommand = "export PGPASSWORD='$dbPassword'; export PGSSLMODE='require'; printf '%s' '$sqlBase64' | base64 -d | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName"

# Creer la definition de tache
$taskDefJson = @{
    family = "yukpomnang-sql-verification-complete"
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
                    "awslogs-stream-prefix" = "complete"
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
        Write-Host "Attente de l'execution (20 secondes)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 20
        
        # Recuperer les logs
        Write-Host ""
        Write-Host "Resultats de la verification:" -ForegroundColor Cyan
        Write-Host "=============================" -ForegroundColor Cyan
        Write-Host ""
        
        $logs = aws logs tail $logGroupName --region $Region --since 2m --format short 2>&1
        
        if ($logs) {
            # Afficher les logs avec formatage
            $logs -split "`n" | ForEach-Object {
                if ($_ -match '✅') {
                    Write-Host $_ -ForegroundColor Green
                } elseif ($_ -match '❌') {
                    Write-Host $_ -ForegroundColor Red
                } elseif ($_ -match 'VERIFICATION|STATISTIQUES|MIGRATIONS|TABLES|FONCTIONS|INDEX|VUE') {
                    Write-Host $_ -ForegroundColor Cyan
                } else {
                    Write-Host $_ -ForegroundColor Gray
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
Write-Host "Pour voir les logs complets:" -ForegroundColor Yellow
Write-Host "   aws logs tail $logGroupName --region $Region --since 5m --format short" -ForegroundColor Gray
Write-Host ""



