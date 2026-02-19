# 🔍 Diagnostic et Correction Redis - Commande Complète

## ✅ **1. Vérifier si ElastiCache existe**

```bash
aws elasticache describe-replication-groups --region eu-west-1 --query 'ReplicationGroups[*].[ReplicationGroupId,Status,PrimaryEndpoint.Address]' --output table
```

**Si vide** → ElastiCache n'existe pas, il faut le créer via Terraform ou manuellement.

---

## ✅ **2. Vérifier REDIS_URL dans Secrets Manager**

```bash
aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | jq -r '.REDIS_URL'
```

**Si vide ou incorrect** → Voir correction ci-dessous.

---

## ✅ **3. Vérifier les Security Groups**

```bash
# Récupérer le Security Group d'ECS
ECS_SG=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text)
echo "ECS Security Group: $ECS_SG"

# Récupérer le Security Group d'ElastiCache
REDIS_SG=$(aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].MemberClusters[0]' --output text | xargs -I {} aws elasticache describe-cache-clusters --cache-cluster-id {} --region eu-west-1 --show-cache-node-info --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text)
echo "Redis Security Group: $REDIS_SG"

# Vérifier si ECS peut accéder à Redis (port 6379)
aws ec2 describe-security-groups --group-ids $REDIS_SG --region eu-west-1 --query "SecurityGroups[0].IpPermissions[?FromPort==\`6379\` && UserIdGroupPairs[?GroupId==\`$ECS_SG\`]]" --output json
```

**Si vide** → Il faut autoriser ECS à accéder à Redis.

---

## ✅ **4. Corriger les Security Groups (si nécessaire)**

```bash
# Autoriser ECS à accéder à Redis
ECS_SG=$(aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text)

REDIS_SG=$(aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].MemberClusters[0]' --output text | xargs -I {} aws elasticache describe-cache-clusters --cache-cluster-id {} --region eu-west-1 --show-cache-node-info --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG \
  --region eu-west-1
```

---

## ✅ **5. Corriger REDIS_URL (si nécessaire)**

```bash
# Récupérer l'endpoint Redis
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text)

# Mettre à jour dans Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text | jq ".REDIS_URL = \"redis://$REDIS_ENDPOINT:6379/0\"" > /tmp/secret-update.json

aws secretsmanager put-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --secret-string file:///tmp/secret-update.json

# Redémarrer ECS pour prendre en compte le nouveau secret
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --region eu-west-1 \
  --force-new-deployment
```

---

## ✅ **6. Script de Diagnostic Complet (PowerShell)**

```powershell
# Diagnostic Redis complet
Write-Host "🔍 Diagnostic Redis..." -ForegroundColor Cyan

# 1. Vérifier ElastiCache
Write-Host "`n1️⃣ Vérification ElastiCache:" -ForegroundColor Yellow
aws elasticache describe-replication-groups --region eu-west-1 --query 'ReplicationGroups[*].[ReplicationGroupId,Status,PrimaryEndpoint.Address]' --output table

# 2. Vérifier REDIS_URL
Write-Host "`n2️⃣ Vérification REDIS_URL:" -ForegroundColor Yellow
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
Write-Host "REDIS_URL: $($secret.REDIS_URL)" -ForegroundColor $(if ($secret.REDIS_URL) { "Green" } else { "Red" })

# 3. Vérifier Security Groups
Write-Host "`n3️⃣ Vérification Security Groups:" -ForegroundColor Yellow
$ecsSg = aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' --output text
Write-Host "ECS Security Group: $ecsSg"

# 4. Tester la connectivité (si possible)
Write-Host "`n4️⃣ Pour tester la connectivité:" -ForegroundColor Yellow
Write-Host "   - Vérifiez que ElastiCache est dans le même VPC qu'ECS" -ForegroundColor Gray
Write-Host "   - Vérifiez que les Security Groups autorisent le port 6379" -ForegroundColor Gray
Write-Host "   - Vérifiez que REDIS_URL pointe vers le bon endpoint" -ForegroundColor Gray

Write-Host "`n✅ Diagnostic terminé" -ForegroundColor Green
```

---

## 📝 **Note Importante**

Si Redis n'est pas critique pour le fonctionnement immédiat de l'application, le code fonctionne en **mode dégradé** (sans Redis). Cependant :
- ❌ Le cache ne fonctionne pas
- ❌ Les notifications en temps réel peuvent être affectées
- ✅ L'application continue de fonctionner pour les fonctionnalités principales

Pour corriger définitivement, il faut :
1. ✅ Créer ElastiCache (via Terraform ou manuellement)
2. ✅ Configurer les Security Groups correctement
3. ✅ Mettre à jour REDIS_URL dans Secrets Manager
4. ✅ Redémarrer le service ECS



