# Script PowerShell pour vérifier l'état des migrations AWS et diagnostiquer le problème
# Usage: .\scripts\check_migrations_aws.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$SSM_DATABASE_URL_PATH = "/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"
$CLUSTER_NAME = "${PROJECT_NAME}-cluster"
$SERVICE_NAME = "${PROJECT_NAME}-backend-service"
$LOG_GROUP = "/ecs/${PROJECT_NAME}-backend"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔍 Diagnostic des Migrations AWS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# 1. Récupérer DATABASE_URL depuis SSM
Write-Host "📋 Étape 1: Récupération de DATABASE_URL depuis SSM..." -ForegroundColor Yellow
try {
    $databaseUrl = aws ssm get-parameter `
        --name $SSM_DATABASE_URL_PATH `
        --region $REGION `
        --with-decryption `
        --query 'Parameter.Value' `
        --output text
    
    if (-not $databaseUrl) {
        Write-Host "❌ Impossible de récupérer DATABASE_URL depuis SSM" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ DATABASE_URL récupérée" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors de la récupération de DATABASE_URL: $_" -ForegroundColor Red
    exit 1
}

# 2. Vérifier l'état des migrations via psql
Write-Host "📋 Étape 2: Vérification de l'état des migrations en base..." -ForegroundColor Yellow

# Extraire les informations de connexion depuis DATABASE_URL
# Format: postgresql://user:password@host:port/database
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "   Host: $dbHost" -ForegroundColor Gray
    Write-Host "   Port: $dbPort" -ForegroundColor Gray
    Write-Host "   Database: $dbName" -ForegroundColor Gray
    Write-Host ""
    
    # Vérifier si la table _sqlx_migrations existe
    $checkMigrationsTable = @"
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = '_sqlx_migrations'
) as exists;
"@
    
    $migrationsTableExists = $env:PGPASSWORD = $dbPassword; psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $checkMigrationsTable 2>&1 | Out-String
    
    if ($migrationsTableExists -match "t|true") {
        Write-Host "✅ Table _sqlx_migrations existe" -ForegroundColor Green
        
        # Lister les migrations appliquées
        $listMigrations = @"
SELECT version, description, success, installed_on 
FROM _sqlx_migrations 
ORDER BY version;
"@
        
        Write-Host ""
        Write-Host "📊 Migrations appliquées:" -ForegroundColor Cyan
        $env:PGPASSWORD = $dbPassword; psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c $listMigrations 2>&1
        
    } else {
        Write-Host "❌ Table _sqlx_migrations n'existe pas - Aucune migration n'a été appliquée" -ForegroundColor Red
    }
    
    Write-Host ""
    
    # Vérifier l'existence des tables critiques
    Write-Host "📋 Étape 3: Vérification de l'existence des tables critiques..." -ForegroundColor Yellow
    
    $criticalTables = @(
        "product_creation_queue",
        "delivery_matching_queue",
        "global_promo_events",
        "live_flash_sales",
        "deliveries",
        "product_orders",
        "social_publication_jobs",
        "video_generation_jobs",
        "delivery_proximity_suggestions"
    )
    
    $checkTablesQuery = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('$($criticalTables -join "','")')
ORDER BY table_name;
"@
    
    $existingTables = $env:PGPASSWORD = $dbPassword; psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $checkTablesQuery 2>&1 | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
    
    Write-Host ""
    Write-Host "📊 Tables critiques existantes:" -ForegroundColor Cyan
    if ($existingTables) {
        foreach ($table in $existingTables) {
            Write-Host "   ✅ $table" -ForegroundColor Green
        }
    } else {
        Write-Host "   ❌ Aucune table critique trouvée" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "📊 Tables critiques manquantes:" -ForegroundColor Cyan
    $missingTables = $criticalTables | Where-Object { $existingTables -notcontains $_ }
    if ($missingTables) {
        foreach ($table in $missingTables) {
            Write-Host "   ❌ $table" -ForegroundColor Red
        }
    } else {
        Write-Host "   ✅ Toutes les tables critiques existent" -ForegroundColor Green
    }
    
} else {
    Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

# 3. Vérifier les logs de démarrage de l'application
Write-Host ""
Write-Host "📋 Étape 4: Vérification des logs de démarrage..." -ForegroundColor Yellow

try {
    # Récupérer les dernières tâches ECS
    $tasks = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --region $REGION `
        --query 'taskArns[]' `
        --output text
    
    if ($tasks) {
        $taskArn = ($tasks -split "`t")[0]
        Write-Host "   Tâche ECS trouvée: $taskArn" -ForegroundColor Gray
        
        # Extraire le task ID
        if ($taskArn -match "task/([^/]+)$") {
            $taskId = $matches[1]
            
            # Chercher les logs de migration dans CloudWatch
            Write-Host ""
            Write-Host "   Recherche des logs de migration..." -ForegroundColor Gray
            
            $logStream = "backend/backend/$taskId"
            $migrationLogs = aws logs filter-log-events `
                --log-group-name $LOG_GROUP `
                --log-stream-names $logStream `
                --filter-pattern "migration" `
                --region $REGION `
                --max-items 50 `
                --query 'events[*].message' `
                --output text 2>&1
            
            if ($migrationLogs -and $migrationLogs -notmatch "ResourceNotFoundException") {
                Write-Host "   📋 Logs de migration trouvés:" -ForegroundColor Cyan
                $migrationLogs -split "`t" | Where-Object { $_ -match "migration|Migration" } | ForEach-Object {
                    Write-Host "      $_" -ForegroundColor Gray
                }
            } else {
                Write-Host "   ⚠️ Aucun log de migration trouvé dans les logs récents" -ForegroundColor Yellow
                Write-Host "   💡 Les migrations peuvent ne pas s'exécuter au démarrage" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "   ⚠️ Aucune tâche ECS en cours d'exécution" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️ Impossible de récupérer les logs: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Diagnostic terminé" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""

# Recommandations
if ($missingTables) {
    Write-Host "🔧 ACTIONS RECOMMANDÉES:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Exécuter les migrations manuellement:" -ForegroundColor White
    Write-Host "   python scripts/run_migrations_aws.py" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Ou via ECS Exec (si activé):" -ForegroundColor White
    Write-Host "   aws ecs execute-command --cluster $CLUSTER_NAME --task <TASK_ID> --container backend --command /bin/bash --interactive" -ForegroundColor Cyan
    Write-Host "   Puis dans le conteneur: cd /app/backend && sqlx migrate run" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Vérifier que le dossier migrations est inclus dans l'image Docker" -ForegroundColor White
    Write-Host ""
}

