# 🔍 Diagnostic des Erreurs Redis

## ❌ **Erreurs Observées**

```
ERROR: Redis connection failed: Connexion Redis échouée: Connection timeout (3s) - tentative 3/3
WARN: ⚠️ [Redis] Toutes les tentatives (3) ont timeout. Redis non accessible - mode dégradé activé.
```

---

## 🔍 **Causes Possibles**

### 1. **ElastiCache Redis non accessible depuis ECS**
- Security Groups ne permettent pas la connexion
- ElastiCache dans un subnet privé sans route
- ElastiCache non créé ou arrêté

### 2. **REDIS_URL incorrect dans Secrets Manager**
- URL mal formatée
- Endpoint ElastiCache incorrect
- Port incorrect (6379 par défaut)

### 3. **Problème réseau**
- VPC/Subnet mal configurés
- Network ACLs bloquent la connexion
- ElastiCache dans un autre VPC

---

## ✅ **Vérifications à Faire**

### 1. **Vérifier que ElastiCache existe et est actif**

```bash
# Lister les clusters ElastiCache
aws elasticache describe-cache-clusters --region eu-west-1 --query 'CacheClusters[*].[CacheClusterId,CacheClusterStatus,Engine,ConfigurationEndpoint.Address]' --output table

# Ou pour Replication Groups
aws elasticache describe-replication-groups --region eu-west-1 --query 'ReplicationGroups[*].[ReplicationGroupId,Status,PrimaryEndpoint.Address]' --output table
```

### 2. **Vérifier REDIS_URL dans Secrets Manager**

```bash
# Récupérer la valeur de REDIS_URL
aws secretsmanager get-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text | jq -r '.REDIS_URL // empty'
```

### 3. **Vérifier les Security Groups**

```bash
# Récupérer le Security Group d'ElastiCache
ELASTICACHE_SG=$(aws elasticache describe-replication-groups \
  --region eu-west-1 \
  --replication-group-id yukpo-redis \
  --query 'ReplicationGroups[0].MemberClusters[0]' \
  --output text | xargs -I {} aws elasticache describe-cache-clusters \
    --cache-cluster-id {} \
    --region eu-west-1 \
    --show-cache-node-info \
    --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' \
    --output text)

# Vérifier les règles du Security Group
aws ec2 describe-security-groups \
  --group-ids $ELASTICACHE_SG \
  --region eu-west-1 \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json

# Récupérer le Security Group d'ECS
ECS_SG=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' \
  --output text)

# Vérifier si ECS peut accéder à ElastiCache
aws ec2 describe-security-groups \
  --group-ids $ELASTICACHE_SG \
  --region eu-west-1 \
  --query "SecurityGroups[0].IpPermissions[?UserIdGroupPairs[?GroupId=='$ECS_SG']]" \
  --output json
```

### 4. **Tester la connexion depuis ECS (via SSM)**

```bash
# Se connecter à l'instance EC2 via SSM
aws ssm start-session --target i-0b9ad404f8d738d04 --region eu-west-1

# Depuis l'instance, tester la connexion Redis
# (Récupérer REDIS_URL depuis Secrets Manager ou depuis la task ECS)
REDIS_URL=$(aws secretsmanager get-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text | jq -r '.REDIS_URL')

# Tester avec redis-cli (si installé) ou telnet
echo $REDIS_URL
# Format attendu: redis://[endpoint]:6379
```

---

## ✅ **Solutions**

### Solution 1: Vérifier et Corriger REDIS_URL

Si REDIS_URL est incorrect ou manquant :

```bash
# Récupérer l'endpoint ElastiCache
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id yukpo-redis \
  --region eu-west-1 \
  --query 'ReplicationGroups[0].PrimaryEndpoint.Address' \
  --output text)

# Mettre à jour REDIS_URL dans Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text | jq ".REDIS_URL = \"redis://$REDIS_ENDPOINT:6379/0\"" | \
aws secretsmanager put-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --secret-string file:///dev/stdin
```

### Solution 2: Corriger les Security Groups

Si ElastiCache n'est pas accessible depuis ECS :

```bash
# Récupérer les IDs
ELASTICACHE_SG=$(aws elasticache describe-replication-groups \
  --replication-group-id yukpo-redis \
  --region eu-west-1 \
  --query 'ReplicationGroups[0].MemberClusters[0]' \
  --output text | xargs -I {} aws elasticache describe-cache-clusters \
    --cache-cluster-id {} \
    --region eu-west-1 \
    --show-cache-node-info \
    --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' \
    --output text)

ECS_SG=$(aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]' \
  --output text)

# Autoriser ECS à accéder à ElastiCache (port 6379)
aws ec2 authorize-security-group-ingress \
  --group-id $ELASTICACHE_SG \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG \
  --region eu-west-1
```

### Solution 3: Vérifier que ElastiCache est dans le bon VPC

```bash
# Vérifier le VPC d'ElastiCache
aws elasticache describe-replication-groups \
  --replication-group-id yukpo-redis \
  --region eu-west-1 \
  --query 'ReplicationGroups[0].CacheSubnetGroupName' \
  --output text | xargs -I {} aws elasticache describe-cache-subnet-groups \
    --cache-subnet-group-name {} \
    --region eu-west-1 \
    --query 'CacheSubnetGroups[0].VpcId' \
    --output text

# Vérifier le VPC d'ECS
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets[0]' \
  --output text | xargs -I {} aws ec2 describe-subnets \
    --subnet-ids {} \
    --region eu-west-1 \
    --query 'Subnets[0].VpcId' \
    --output text
```

---

## ✅ **Commande de Diagnostic Complète**

```bash
#!/bin/bash
# Script de diagnostic Redis

echo "🔍 Diagnostic Redis..."
echo ""

# 1. Vérifier ElastiCache
echo "1️⃣ Vérification ElastiCache:"
aws elasticache describe-replication-groups \
  --region eu-west-1 \
  --query 'ReplicationGroups[*].[ReplicationGroupId,Status,PrimaryEndpoint.Address]' \
  --output table

# 2. Vérifier REDIS_URL
echo ""
echo "2️⃣ Vérification REDIS_URL:"
REDIS_URL=$(aws secretsmanager get-secret-value \
  --secret-id yukpo/backend/secrets \
  --region eu-west-1 \
  --query 'SecretString' \
  --output text | jq -r '.REDIS_URL // "NON DÉFINI"')
echo "REDIS_URL: $REDIS_URL"

# 3. Vérifier Security Groups
echo ""
echo "3️⃣ Vérification Security Groups:"
# (Commandes complexes, voir ci-dessus)

echo ""
echo "✅ Diagnostic terminé"
```

---

## 📝 **Note**

Si Redis n'est pas critique pour le fonctionnement de l'application, le mode dégradé permet de continuer à fonctionner. Cependant, certaines fonctionnalités (cache, notifications en temps réel) peuvent être affectées.


