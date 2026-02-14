# 🔴 Vérifier la Connexion Redis

## ✅ **Commandes de Diagnostic**

### 1. Vérifier REDIS_URL dans Secrets Manager

```powershell
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
Write-Host "REDIS_URL: $($secret.REDIS_URL)"
```

---

### 2. Vérifier les Security Groups

```powershell
# ECS Security Group
$ecsSg = aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text
Write-Host "ECS SG: $ecsSg"

# Redis Security Group
$redisClusterId = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].MemberClusters[0]' --output text
$redisSg = aws elasticache describe-cache-clusters --cache-cluster-id $redisClusterId --region eu-west-1 --show-cache-node-info --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text
Write-Host "Redis SG: $redisSg"

# Vérifier l'accès
aws ec2 describe-security-groups --group-ids $redisSg --region eu-west-1 --query "SecurityGroups[0].IpPermissions[?FromPort==\`6379\` && UserIdGroupPairs[?GroupId==\`$ecsSg\`]]" --output json
```

---

### 3. Forcer un Nouveau Redéploiement

```powershell
# Forcer un nouveau redéploiement pour s'assurer que le nouveau secret est utilisé
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
Write-Host "Service redémarré. Attendez 2-3 minutes." -ForegroundColor Yellow
```

---

### 4. Vérifier le Statut du Service

```powershell
# Vérifier que le service est stable
aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].[status,runningCount,desiredCount]' --output table
```

