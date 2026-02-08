# Script pour appliquer les optimisations AWS de manière incrémentale
# Sans remplacer le VPC ni les ressources critiques

param(
    [string]$Region = "eu-west-1"
)

Write-Host "=== Application des Optimisations AWS (Approche Incrementale) ===" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host ""

# 1. Optimiser RDS
Write-Host "[1/5] Optimisation RDS..." -ForegroundColor Green
Write-Host "  - Instance: db.t3.medium -> db.t3.micro" -ForegroundColor Gray
Write-Host "  - Backup retention: 7 -> 3 jours" -ForegroundColor Gray
Write-Host "  - Max storage: 100 -> 50 GB" -ForegroundColor Gray

$rdsInstanceId = "db-3ZRWYR2I5NEKRMJO33U4DFEAFM"
Write-Host "  Instance ID: $rdsInstanceId" -ForegroundColor Gray

# Modifier l'instance RDS
Write-Host "  Modification de l'instance RDS..." -ForegroundColor Yellow
try {
    aws rds modify-db-instance `
        --db-instance-identifier $rdsInstanceId `
        --db-instance-class db.t3.micro `
        --backup-retention-period 3 `
        --max-allocated-storage 50 `
        --apply-immediately `
        --region $Region
    
    Write-Host "  ✅ RDS modification initiée (peut prendre 5-10 minutes)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Erreur lors de la modification RDS: $_" -ForegroundColor Red
    Write-Host "  ⚠️  Vous pouvez le faire manuellement via AWS Console" -ForegroundColor Yellow
}

Write-Host ""

# 2. Optimiser ElastiCache
Write-Host "[2/5] Optimisation ElastiCache..." -ForegroundColor Green
Write-Host "  - Node type: cache.t3.small -> cache.t3.micro" -ForegroundColor Gray

$redisReplicationGroupId = "yukpomnang-redis"
Write-Host "  Replication Group ID: $redisReplicationGroupId" -ForegroundColor Gray

# Note: ElastiCache nécessite une modification via AWS Console ou CLI complexe
Write-Host "  ⚠️  Modification ElastiCache nécessite:" -ForegroundColor Yellow
Write-Host "     1. Créer un nouveau cluster cache.t3.micro" -ForegroundColor Gray
Write-Host "     2. Migrer les données (si nécessaire)" -ForegroundColor Gray
Write-Host "     3. Mettre à jour REDIS_URL dans Secrets Manager" -ForegroundColor Gray
Write-Host "     4. Supprimer l'ancien cluster" -ForegroundColor Gray
Write-Host "  ⚠️  Cette opération est complexe, faire manuellement via AWS Console" -ForegroundColor Yellow

Write-Host ""

# 3. Optimiser ECS Service
Write-Host "[3/5] Optimisation ECS Service..." -ForegroundColor Green
Write-Host "  - Desired count: 2 -> 1" -ForegroundColor Gray

$ecsCluster = "yukpomnang-cluster"
$ecsService = "yukpomnang-backend-service"

Write-Host "  Cluster: $ecsCluster" -ForegroundColor Gray
Write-Host "  Service: $ecsService" -ForegroundColor Gray

# Vérifier si le service existe
Write-Host "  Vérification du service ECS..." -ForegroundColor Yellow
try {
    $serviceExists = aws ecs describe-services `
        --cluster $ecsCluster `
        --services $ecsService `
        --region $Region 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Modification du desired count..." -ForegroundColor Yellow
        aws ecs update-service `
            --cluster $ecsCluster `
            --service $ecsService `
            --desired-count 1 `
            --region $Region
        
        Write-Host "  ✅ ECS service mis à jour (desired count = 1)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Service ECS non trouvé, vérifier le nom" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Erreur lors de la modification ECS: $_" -ForegroundColor Red
    Write-Host "  ⚠️  Vous pouvez le faire manuellement via AWS Console" -ForegroundColor Yellow
}

Write-Host ""

# 4. Optimiser CloudWatch Logs
Write-Host "[4/5] Optimisation CloudWatch Logs..." -ForegroundColor Green
Write-Host "  - Retention: 7 -> 3 jours" -ForegroundColor Gray

$logGroupName = "/ecs/yukpomnang-backend"
Write-Host "  Log Group: $logGroupName" -ForegroundColor Gray

try {
    aws logs put-retention-policy `
        --log-group-name $logGroupName `
        --retention-in-days 3 `
        --region $Region
    
    Write-Host "  ✅ CloudWatch log retention mis à jour (3 jours)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Erreur lors de la modification CloudWatch: $_" -ForegroundColor Red
    Write-Host "  ⚠️  Vous pouvez le faire manuellement via AWS Console" -ForegroundColor Yellow
}

Write-Host ""

# 5. Résumé
Write-Host "[5/5] Résumé des Optimisations" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Optimisations appliquées ou en cours:" -ForegroundColor Cyan
Write-Host "  - RDS: db.t3.micro, backup 3 jours, max storage 50 GB" -ForegroundColor White
Write-Host "  - ECS: 1 task au lieu de 2" -ForegroundColor White
Write-Host "  - CloudWatch: retention 3 jours" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  À faire manuellement:" -ForegroundColor Yellow
Write-Host "  - ElastiCache: Modifier node type via AWS Console" -ForegroundColor White
Write-Host "  - Mettre à jour REDIS_URL dans Secrets Manager après modification ElastiCache" -ForegroundColor White
Write-Host ""
Write-Host "💰 Économies estimées: ~$80-115/mois" -ForegroundColor Green
Write-Host ""
Write-Host "=== Fin des Optimisations ===" -ForegroundColor Cyan



