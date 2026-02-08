# Script pour verifier l'etat des migrations dans la base de donnees
# Utilise ECS Exec sur une tache existante

$ErrorActionPreference = "Continue"

$REGION = "us-east-1"
$CLUSTER_NAME = "yukpomnang-cluster"
$SERVICE_NAME = "yukpomnang-backend-service"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Verification de l'etat des migrations dans PostgreSQL AWS" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# Trouver une tache en cours
Write-Host "Etape 1: Recherche d'une tache en cours..." -ForegroundColor Yellow

$taskArn = aws ecs list-tasks `
    --cluster $CLUSTER_NAME `
    --service-name $SERVICE_NAME `
    --desired-status RUNNING `
    --region $REGION `
    --query 'taskArns[0]' `
    --output text

if (-not $taskArn) {
    Write-Host "Aucune tache en cours. Demarrage du service..." -ForegroundColor Red
    aws ecs update-service `
        --cluster $CLUSTER_NAME `
        --service $SERVICE_NAME `
        --desired-count 1 `
        --region $REGION | Out-Null
    
    Write-Host "Attente de 30 secondes..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    $taskArn = aws ecs list-tasks `
        --cluster $CLUSTER_NAME `
        --service-name $SERVICE_NAME `
        --desired-status RUNNING `
        --region $REGION `
        --query 'taskArns[0]' `
        --output text
}

if (-not $taskArn) {
    Write-Host "Impossible de trouver une tache" -ForegroundColor Red
    exit 1
}

$taskId = $taskArn -replace '.*/', ''
Write-Host "Tache trouvee: $taskId" -ForegroundColor Green
Write-Host ""

# Creer un script SQL de verification
$sqlScript = @"
-- Verification des colonnes de product_delivery_config
\echo '=== Colonnes de product_delivery_config ==='
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN (
    'preparation_time_minutes',
    'storage_location_id',
    'max_preparation_time_minutes',
    'availability_days',
    'is_immediately_available'
)
ORDER BY column_name;

-- Verification des index
\echo ''
\echo '=== Index sur availability_days ==='
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'product_delivery_config' 
AND indexname LIKE '%availability%';

\echo ''
\echo '=== Index sur storage_location_id ==='
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'product_delivery_config' 
AND indexname LIKE '%storage_location%';

-- Verification des migrations SQLx
\echo ''
\echo '=== Dernieres migrations SQLx appliquees ==='
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations
ORDER BY version DESC
LIMIT 10;

\echo ''
\echo '=== Nombre total de migrations ==='
SELECT COUNT(*) as total_migrations FROM _sqlx_migrations WHERE success = true;
"@

Write-Host "Etape 2: Creation d'un script SQL temporaire..." -ForegroundColor Yellow

$sqlFile = "verify_migrations_temp.sql"
$sqlScript | Out-File -FilePath $sqlFile -Encoding UTF8

Write-Host "Fichier SQL cree: $sqlFile" -ForegroundColor Gray
Write-Host ""

# Vérifier si Session Manager Plugin est disponible
$ssmPlugin = Get-Command session-manager-plugin -ErrorAction SilentlyContinue

if ($ssmPlugin) {
    Write-Host "Etape 3: Execution des requetes SQL via ECS Exec..." -ForegroundColor Yellow
    Write-Host ""
    
    # Copier le fichier SQL dans le conteneur et l'executer
    $command = "cd /app/backend && cat > /tmp/verify_migrations.sql << 'EOFSQL'
$sqlScript
EOFSQL
psql `$DATABASE_URL -f /tmp/verify_migrations.sql"
    
    Write-Host "Commande preparee. Execution..." -ForegroundColor Gray
    Write-Host ""
    
    aws ecs execute-command `
        --cluster $CLUSTER_NAME `
        --task $taskArn `
        --container backend `
        --command $command `
        --interactive `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Verification terminee avec succes!" -ForegroundColor Green
    }
} else {
    Write-Host "Etape 3: Session Manager Plugin non trouve" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Instructions pour verifier manuellement:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Installer Session Manager Plugin:" -ForegroundColor White
    Write-Host "   winget install Amazon.SessionManagerPlugin" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Executer cette commande:" -ForegroundColor White
    Write-Host "   aws ecs execute-command --cluster $CLUSTER_NAME --task $taskArn --container backend --command `"psql `$DATABASE_URL -f /tmp/verify_migrations.sql`" --interactive --region $REGION" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Ou via AWS Console:" -ForegroundColor White
    Write-Host "   - ECS Console -> Clusters -> $CLUSTER_NAME" -ForegroundColor Gray
    Write-Host "   - Tasks -> $taskId -> Execute Command -> Execute" -ForegroundColor Gray
    Write-Host "   - Executer: psql `$DATABASE_URL -f /tmp/verify_migrations.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Le fichier SQL est disponible: $sqlFile" -ForegroundColor Gray
}

# Nettoyer
Remove-Item $sqlFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "Termine!" -ForegroundColor Green
Write-Host "=================================================================================="
Write-Host ""



