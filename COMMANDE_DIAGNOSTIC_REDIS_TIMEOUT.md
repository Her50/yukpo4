# 🔴 Diagnostic Redis Timeout Persistant

## ✅ **Colonnes Corrigées**

Toutes les colonnes ont été corrigées avec succès :
- ✅ `global_promo_entries.event_id`
- ✅ `live_flash_sales.stock_target`
- ✅ `social_publication_jobs.payload`

---

## ❌ **Redis Timeout Persistant (> 5 minutes)**

Si les erreurs Redis persistent après 5+ minutes, vérifiez :

### 1. **Vérifier que le service ECS a bien redémarré**

```powershell
# Vérifier les déploiements récents
aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].deployments[*].[id,status,createdAt]' --output table
```

Le dernier déploiement doit être récent (après la mise à jour de REDIS_URL).

---

### 2. **Vérifier REDIS_URL dans Secrets Manager**

```powershell
# Vérifier la valeur actuelle
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
Write-Host "REDIS_URL actuel: $($secret.REDIS_URL)"
```

Doit être : `redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0`

---

### 3. **Vérifier les Security Groups**

```powershell
# Récupérer le Security Group d'ECS
$ecsSg = aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text

# Récupérer le Security Group de Redis
$redisClusterId = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].MemberClusters[0]' --output text
$redisSg = aws elasticache describe-cache-clusters --cache-cluster-id $redisClusterId --region eu-west-1 --show-cache-node-info --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text

# Vérifier les règles
aws ec2 describe-security-groups --group-ids $redisSg --region eu-west-1 --query "SecurityGroups[0].IpPermissions[?FromPort==\`6379\`]" --output json | ConvertFrom-Json
```

---

### 4. **Forcer un nouveau redéploiement ECS**

```powershell
# Forcer un nouveau redéploiement pour s'assurer que le nouveau secret est utilisé
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment

# Attendre 2-3 minutes
Write-Host "Attendez 2-3 minutes pour que le service redémarre..." -ForegroundColor Yellow
```

---

### 5. **Vérifier la connectivité réseau**

Si les Security Groups sont corrects mais que Redis ne répond toujours pas, vérifiez :
- ElastiCache est dans le même VPC qu'ECS
- Les subnets permettent la communication
- ElastiCache est actif et accessible

```powershell
# Vérifier le statut d'ElastiCache
aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address]' --output table
```

---

## ✅ **Solution Alternative : Désactiver Temporairement Redis**

Si Redis n'est pas critique immédiatement, le backend fonctionne en mode dégradé. Pour désactiver complètement les tentatives Redis :

```powershell
# Mettre REDIS_URL à une valeur vide pour désactiver Redis
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
$secret.REDIS_URL = ""
$secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret.json" -Encoding UTF8
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret.json" -Raw)
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
```

**Note** : Cette solution désactive Redis complètement. Utilisez-la seulement si Redis n'est pas critique.


