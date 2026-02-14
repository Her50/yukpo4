# ============================================
# SCRIPT COMPLET DE CORRECTION YUKPOMNANG
# ============================================
# Corrige les colonnes PostgreSQL + Configure Redis
# ============================================

$ErrorActionPreference = "Continue"
Write-Host "Correction complete Yukpomnang" -ForegroundColor Cyan
Write-Host ""

# Variables
$region = "eu-west-1"
$projectName = "yukpo"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"

# ============================================
# PARTIE 1: CORRECTION COLONNES POSTGRESQL
# ============================================
Write-Host "1. Correction des colonnes PostgreSQL..." -ForegroundColor Yellow

$env:PGPASSWORD = $dbPassword

# Créer un fichier SQL temporaire
$sqlFile = "$env:TEMP\fix_columns.sql"
@'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'start_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE 'start_date renomme en starts_at';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'end_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE 'end_date renomme en ends_at';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at') THEN
        ALTER TABLE live_flash_sales ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE 'ending_notification_sent_at ajoute';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform') THEN
        ALTER TABLE social_publication_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE 'platform ajoute';
    END IF;
END $$;

SELECT 'global_promo_events.starts_at' as colonne, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL SELECT 'global_promo_events.ends_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'ends_at')
UNION ALL SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
'@ | Out-File -FilePath $sqlFile -Encoding UTF8 -NoNewline

$psqlResult = psql -h $dbHost -p 5432 -U yukpo_admin -d yukpo -f $sqlFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host $psqlResult
    Write-Host "Colonnes corrigees" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Impossible de se connecter a PostgreSQL depuis Windows" -ForegroundColor Red
    Write-Host "Cause probable: Firewall ou reseau bloque la connexion" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solution: Executez la correction SQL directement depuis EC2:" -ForegroundColor Cyan
    Write-Host "  1. Connectez-vous a EC2 via SSM" -ForegroundColor White
    Write-Host "  2. Executez la commande SQL (voir COMMANDE_CORRECTION_FINALE_RENOMMAGE_EC2.md)" -ForegroundColor White
    Write-Host ""
    Write-Host "OU depuis EC2:" -ForegroundColor Cyan
    Write-Host "  PGPASSWORD=`"$dbPassword`" psql -h $dbHost -p 5432 -U yukpo_admin -d yukpo -f /tmp/fix_columns.sql" -ForegroundColor White
}

Remove-Item $sqlFile -ErrorAction SilentlyContinue
Write-Host ""

# ============================================
# PARTIE 2: VERIFICATION REDIS
# ============================================
Write-Host ""
Write-Host "2. Verification Redis..." -ForegroundColor Yellow

$redisId = "$projectName-redis"
$redisExists = aws elasticache describe-replication-groups --replication-group-id $redisId --region $region --query 'ReplicationGroups[0].ReplicationGroupId' --output text 2>$null

if ($redisExists -eq $redisId) {
    Write-Host "ElastiCache existe: $redisId" -ForegroundColor Green
    
    # Récupérer endpoint
    $redisEndpoint = aws elasticache describe-replication-groups --replication-group-id $redisId --region $region --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text
    
    if ([string]::IsNullOrWhiteSpace($redisEndpoint) -or $redisEndpoint -eq "None") {
        Write-Host "   ATTENTION: Endpoint Redis non disponible (cluster peut-etre en cours de creation)" -ForegroundColor Yellow
        Write-Host "   Verifiez le statut du cluster:" -ForegroundColor Yellow
        $redisStatus = aws elasticache describe-replication-groups --replication-group-id $redisId --region $region --query 'ReplicationGroups[0].Status' --output text
        Write-Host "   Statut: $redisStatus" -ForegroundColor Gray
        
        if ($redisStatus -eq "creating" -or $redisStatus -eq "modifying") {
            Write-Host "   Le cluster est en cours de creation/modification. Attendez quelques minutes puis re-executez ce script." -ForegroundColor Yellow
        } else {
            Write-Host "   Le cluster existe mais n'a pas d'endpoint. Verifiez la configuration." -ForegroundColor Red
        }
    } else {
        Write-Host "   Endpoint: $redisEndpoint" -ForegroundColor Gray
        
        # Vérifier Security Groups
        $ecsSg = aws ecs describe-services --cluster "$projectName-cluster" --services "$projectName-backend-service" --region $region --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text
        
        if ($ecsSg) {
            $redisClusterId = aws elasticache describe-replication-groups --replication-group-id $redisId --region $region --query 'ReplicationGroups[0].MemberClusters[0]' --output text
            
            if ($redisClusterId) {
                $redisSg = aws elasticache describe-cache-clusters --cache-cluster-id $redisClusterId --region $region --show-cache-node-info --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text
                
                if ($redisSg) {
                    # Vérifier l'accès avec une requête simplifiée
                    $sgRules = aws ec2 describe-security-groups --group-ids $redisSg --region $region --query 'SecurityGroups[0].IpPermissions' --output json | ConvertFrom-Json
                    $hasAccess = $false
                    
                    foreach ($rule in $sgRules) {
                        if ($rule.FromPort -eq 6379 -and $rule.UserIdGroupPairs) {
                            foreach ($pair in $rule.UserIdGroupPairs) {
                                if ($pair.GroupId -eq $ecsSg) {
                                    $hasAccess = $true
                                    break
                                }
                            }
                        }
                        if ($hasAccess) { break }
                    }
                    
                    if (-not $hasAccess) {
                        Write-Host "Autorisation ECS -> Redis..." -ForegroundColor Yellow
                        $result = aws ec2 authorize-security-group-ingress --group-id $redisSg --protocol tcp --port 6379 --source-group $ecsSg --region $region 2>&1
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "Acces autorise" -ForegroundColor Green
                        } else {
                            # Peut-être déjà autorisé
                            if ($result -match "already exists") {
                                Write-Host "Acces deja autorise" -ForegroundColor Green
                            } else {
                                Write-Host "Erreur lors de l'autorisation: $result" -ForegroundColor Yellow
                            }
                        }
                    } else {
                        Write-Host "Acces ECS -> Redis deja configure" -ForegroundColor Green
                    }
                }
            }
        }
        
        # Mettre à jour REDIS_URL seulement si l'endpoint est valide
        if ($redisEndpoint -and $redisEndpoint -ne "None") {
            Write-Host "Mise a jour REDIS_URL..." -ForegroundColor Yellow
            $secret = aws secretsmanager get-secret-value --secret-id "$projectName/backend/secrets" --region $region --query 'SecretString' --output text | ConvertFrom-Json
            $newRedisUrl = "redis://$redisEndpoint:6379/0"
            
            if ($secret.REDIS_URL -ne $newRedisUrl) {
                $secret.REDIS_URL = $newRedisUrl
                $secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-redis.json" -Encoding UTF8
                aws secretsmanager put-secret-value --secret-id "$projectName/backend/secrets" --region $region --secret-string (Get-Content "$env:TEMP\secret-redis.json" -Raw) | Out-Null
                Write-Host "REDIS_URL mis a jour: $newRedisUrl" -ForegroundColor Green
                
                # Redémarrer ECS
                Write-Host "Redemarrage ECS..." -ForegroundColor Yellow
                aws ecs update-service --cluster "$projectName-cluster" --service "$projectName-backend-service" --region $region --force-new-deployment | Out-Null
                Write-Host "ECS redemarre (attendre 2-3 min)" -ForegroundColor Green
            } else {
                Write-Host "REDIS_URL deja correct" -ForegroundColor Green
            }
        }
    }
} else {
    Write-Host "ElastiCache n'existe pas" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour creer ElastiCache, executez:" -ForegroundColor Cyan
    Write-Host "  cd infra/aws" -ForegroundColor White
    Write-Host "  terraform apply" -ForegroundColor White
    Write-Host ""
    Write-Host "OU creez-le manuellement (voir COMMANDE_COMPLETE_CORRECTION_TOTALE.md)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "CORRECTION TERMINEE" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan

