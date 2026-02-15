# 🚀 Commande Complète - Correction Totale (Colonnes + Redis)

## ✅ **Script PowerShell Complet**

```powershell
# ============================================
# SCRIPT COMPLET DE CORRECTION
# ============================================
# 1. Corrige les colonnes manquantes dans PostgreSQL
# 2. Vérifie et crée ElastiCache Redis si nécessaire
# 3. Configure les Security Groups
# 4. Met à jour REDIS_URL dans Secrets Manager
# 5. Redémarre ECS
# ============================================

Write-Host "🚀 Démarrage de la correction complète..." -ForegroundColor Cyan
Write-Host ""

# ============================================
# PARTIE 1: CORRECTION DES COLONNES POSTGRESQL
# ============================================
Write-Host "📊 PARTIE 1: Correction des colonnes PostgreSQL..." -ForegroundColor Yellow

$psqlCommand = @"
-- 1. Renommer start_date → starts_at
DO `$$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'start_date'
    ) THEN
        ALTER TABLE global_promo_events RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE '✅ start_date renommé en starts_at';
    END IF;
END `$$;

-- 2. Renommer end_date → ends_at
DO `$$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'end_date'
    ) THEN
        ALTER TABLE global_promo_events RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE '✅ end_date renommé en ends_at';
    END IF;
END `$$;

-- 3. Ajouter ending_notification_sent_at
DO `$$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at'
    ) THEN
        ALTER TABLE live_flash_sales ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE '✅ ending_notification_sent_at ajouté';
    END IF;
END `$$;

-- 4. Ajouter platform
DO `$$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'platform'
    ) THEN
        ALTER TABLE social_publication_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE '✅ platform ajouté';
    END IF;
END `$$;

-- Vérification
SELECT 
    'global_promo_events.starts_at' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL
SELECT 'global_promo_events.ends_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'ends_at')
UNION ALL
SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
"@

$env:PGPASSWORD = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$psqlResult = $psqlCommand | psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo 2>&1
Write-Host $psqlResult
Write-Host "✅ Colonnes corrigées" -ForegroundColor Green
Write-Host ""

# ============================================
# PARTIE 2: VÉRIFICATION ET CRÉATION REDIS
# ============================================
Write-Host "🔴 PARTIE 2: Vérification et configuration Redis..." -ForegroundColor Yellow

$region = "eu-west-1"
$projectName = "yukpo"
$redisReplicationGroupId = "$projectName-redis"

# Vérifier si ElastiCache existe
Write-Host "Vérification de l'existence d'ElastiCache..." -ForegroundColor Gray
$redisExists = aws elasticache describe-replication-groups --replication-group-id $redisReplicationGroupId --region $region --query 'ReplicationGroups[0].ReplicationGroupId' --output text 2>$null

if ($redisExists -eq $redisReplicationGroupId) {
    Write-Host "✅ ElastiCache existe déjà: $redisReplicationGroupId" -ForegroundColor Green
    
    # Récupérer l'endpoint
    $redisEndpoint = aws elasticache describe-replication-groups --replication-group-id $redisReplicationGroupId --region $region --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text
    Write-Host "Endpoint Redis: $redisEndpoint" -ForegroundColor Gray
} else {
    Write-Host "⚠️ ElastiCache n'existe pas. Création via Terraform recommandée..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour créer ElastiCache, exécutez:" -ForegroundColor Cyan
    Write-Host "  cd infra/aws" -ForegroundColor White
    Write-Host "  terraform plan" -ForegroundColor White
    Write-Host "  terraform apply" -ForegroundColor White
    Write-Host ""
    Write-Host "OU créez-le manuellement avec les commandes ci-dessous..." -ForegroundColor Yellow
    
    # Récupérer les informations nécessaires
    $vpcId = aws ec2 describe-vpcs --filters "Name=tag:Name,Values=$projectName-vpc" --region $region --query 'Vpcs[0].VpcId' --output text
    if (-not $vpcId) {
        $vpcId = aws ec2 describe-vpcs --region $region --query 'Vpcs[0].VpcId' --output text
    }
    
    $subnets = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --region $region --query 'Subnets[*].SubnetId' --output text
    $subnetArray = $subnets -split '\s+'
    $subnet1 = $subnetArray[0]
    $subnet2 = $subnetArray[1]
    
    $ecsSg = aws ecs describe-services --cluster "$projectName-cluster" --services "$projectName-backend-service" --region $region --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text
    
    Write-Host ""
    Write-Host "Commandes pour créer ElastiCache manuellement:" -ForegroundColor Cyan
    Write-Host @"
# 1. Créer le subnet group
aws elasticache create-cache-subnet-group `
  --cache-subnet-group-name "$projectName-redis-subnet-group" `
  --cache-subnet-group-description "Subnet group for $projectName Redis" `
  --subnet-ids $subnet1 $subnet2 `
  --region $region

# 2. Créer le Security Group pour Redis
aws ec2 create-security-group `
  --group-name "$projectName-redis-sg" `
  --description "Security group for $projectName Redis" `
  --vpc-id $vpcId `
  --region $region | ConvertFrom-Json | Select-Object -ExpandProperty GroupId

# 3. Autoriser ECS à accéder à Redis (port 6379)
# Remplacez sg-redis-id par l'ID du Security Group créé ci-dessus
aws ec2 authorize-security-group-ingress `
  --group-id sg-redis-id `
  --protocol tcp `
  --port 6379 `
  --source-group $ecsSg `
  --region $region

# 4. Créer le cluster Redis
aws elasticache create-replication-group `
  --replication-group-id "$redisReplicationGroupId" `
  --description "Redis cluster for $projectName" `
  --engine redis `
  --engine-version "7.0" `
  --cache-node-type "cache.t3.micro" `
  --num-cache-clusters 1 `
  --cache-subnet-group-name "$projectName-redis-subnet-group" `
  --security-group-ids sg-redis-id `
  --port 6379 `
  --region $region
"@ -ForegroundColor White
    
    Write-Host ""
    Write-Host "⚠️ Après création, exécutez à nouveau ce script pour mettre à jour REDIS_URL" -ForegroundColor Yellow
    exit 1
}

# ============================================
# PARTIE 3: VÉRIFICATION DES SECURITY GROUPS
# ============================================
Write-Host ""
Write-Host "🔒 PARTIE 3: Vérification des Security Groups..." -ForegroundColor Yellow

$ecsSg = aws ecs describe-services --cluster "$projectName-cluster" --services "$projectName-backend-service" --region $region --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text
Write-Host "ECS Security Group: $ecsSg" -ForegroundColor Gray

# Récupérer le Security Group de Redis
$redisClusterId = aws elasticache describe-replication-groups --replication-group-id $redisReplicationGroupId --region $region --query 'ReplicationGroups[0].MemberClusters[0]' --output text
$redisSg = aws elasticache describe-cache-clusters --cache-cluster-id $redisClusterId --region $region --show-cache-node-info --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text
Write-Host "Redis Security Group: $redisSg" -ForegroundColor Gray

# Vérifier si ECS peut accéder à Redis
$hasAccess = aws ec2 describe-security-groups --group-ids $redisSg --region $region --query "SecurityGroups[0].IpPermissions[?FromPort==\`6379\` && UserIdGroupPairs[?GroupId==\`$ecsSg\`]]" --output json | ConvertFrom-Json

if ($hasAccess.Count -eq 0) {
    Write-Host "⚠️ ECS n'a pas accès à Redis. Autorisation en cours..." -ForegroundColor Yellow
    aws ec2 authorize-security-group-ingress `
      --group-id $redisSg `
      --protocol tcp `
      --port 6379 `
      --source-group $ecsSg `
      --region $region
    Write-Host "✅ Accès autorisé" -ForegroundColor Green
} else {
    Write-Host "✅ ECS a déjà accès à Redis" -ForegroundColor Green
}

# ============================================
# PARTIE 4: MISE À JOUR REDIS_URL
# ============================================
Write-Host ""
Write-Host "🔧 PARTIE 4: Mise à jour REDIS_URL dans Secrets Manager..." -ForegroundColor Yellow

$redisEndpoint = aws elasticache describe-replication-groups --replication-group-id $redisReplicationGroupId --region $region --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text
$redisUrl = "redis://$redisEndpoint:6379/0"
Write-Host "Nouveau REDIS_URL: $redisUrl" -ForegroundColor Gray

# Récupérer le secret actuel
$secretJson = aws secretsmanager get-secret-value --secret-id "$projectName/backend/secrets" --region $region --query 'SecretString' --output text | ConvertFrom-Json

# Mettre à jour REDIS_URL
$secretJson.REDIS_URL = $redisUrl
$secretJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-update.json" -Encoding UTF8

# Mettre à jour le secret
aws secretsmanager put-secret-value `
  --secret-id "$projectName/backend/secrets" `
  --region $region `
  --secret-string (Get-Content "$env:TEMP\secret-update.json" -Raw)

Write-Host "✅ REDIS_URL mis à jour dans Secrets Manager" -ForegroundColor Green

# ============================================
# PARTIE 5: REDÉMARRAGE ECS
# ============================================
Write-Host ""
Write-Host "🔄 PARTIE 5: Redémarrage du service ECS..." -ForegroundColor Yellow

aws ecs update-service `
  --cluster "$projectName-cluster" `
  --service "$projectName-backend-service" `
  --region $region `
  --force-new-deployment | Out-Null

Write-Host "✅ Service ECS redémarré. Attendez 2-3 minutes pour que les changements prennent effet." -ForegroundColor Green

# ============================================
# RÉSUMÉ
# ============================================
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "✅ CORRECTION COMPLÈTE TERMINÉE" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Résumé des actions:" -ForegroundColor Yellow
Write-Host "  ✅ Colonnes PostgreSQL corrigées" -ForegroundColor Green
Write-Host "  ✅ ElastiCache Redis vérifié/configuré" -ForegroundColor Green
Write-Host "  ✅ Security Groups configurés" -ForegroundColor Green
Write-Host "  ✅ REDIS_URL mis à jour" -ForegroundColor Green
Write-Host "  ✅ Service ECS redémarré" -ForegroundColor Green
Write-Host ""
Write-Host "Vérifiez les logs dans 2-3 minutes:" -ForegroundColor Cyan
Write-Host "  https://console.aws.amazon.com/cloudwatch/" -ForegroundColor White
```

---

## ✅ **Version Simplifiée (si Terraform est déjà appliqué)**

Si ElastiCache existe déjà via Terraform, utilisez cette version plus simple :

```powershell
# Correction des colonnes PostgreSQL
$env:PGPASSWORD = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
@"
-- 1. Renommer start_date → starts_at
DO `$$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'start_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE '✅ start_date renommé en starts_at';
    END IF;
END `$$;
-- 2. Renommer end_date → ends_at
DO `$$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'end_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE '✅ end_date renommé en ends_at';
    END IF;
END `$$;
-- 3. Ajouter ending_notification_sent_at
DO `$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at') THEN
        ALTER TABLE live_flash_sales ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE '✅ ending_notification_sent_at ajouté';
    END IF;
END `$$;
-- 4. Ajouter platform
DO `$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform') THEN
        ALTER TABLE social_publication_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE '✅ platform ajouté';
    END IF;
END `$$;
SELECT 'global_promo_events.starts_at' as colonne, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL SELECT 'global_promo_events.ends_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'ends_at')
UNION ALL SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
"@ | psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo

# Mise à jour REDIS_URL si ElastiCache existe
$redisEndpoint = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text 2>$null
if ($redisEndpoint) {
    $secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
    $secret.REDIS_URL = "redis://$redisEndpoint:6379/0"
    $secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret.json" -Encoding UTF8
    aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret.json" -Raw)
    aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
    Write-Host "✅ REDIS_URL mis à jour et ECS redémarré" -ForegroundColor Green
}
```


