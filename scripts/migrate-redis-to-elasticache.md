# Migration Redis Upstash → ElastiCache AWS

## 🎯 Objectif

Migrer de Redis Upstash (rate-limited) vers ElastiCache Redis sur AWS pour :
- ✅ Éliminer les problèmes de rate limiting
- ✅ Réduire les coûts (si bien configuré)
- ✅ Améliorer les performances (latence réduite)
- ✅ Centraliser l'infrastructure sur AWS

## 📋 Prérequis

1. ElastiCache Redis créé via Terraform
2. Endpoint ElastiCache disponible
3. Accès à Secrets Manager AWS
4. Backend déployé sur ECS

## 🔧 Étapes de Migration

### Étape 1 : Vérifier ElastiCache

```powershell
# Vérifier que ElastiCache est créé et actif
aws elasticache describe-replication-groups `
  --replication-group-id yukpomnang-redis `
  --region eu-west-1 `
  --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address,PrimaryEndpoint.Port]'
```

**Résultat attendu** :
- Status : `available`
- Address : `yukpomnang-redis.xxxxx.cache.amazonaws.com`
- Port : `6379`

### Étape 2 : Récupérer l'Endpoint ElastiCache

```powershell
# Récupérer l'endpoint complet
$redisEndpoint = aws elasticache describe-replication-groups `
  --replication-group-id yukpomnang-redis `
  --region eu-west-1 `
  --query 'ReplicationGroups[0].PrimaryEndpoint.Address' `
  --output text

$redisPort = aws elasticache describe-replication-groups `
  --replication-group-id yukpomnang-redis `
  --region eu-west-1 `
  --query 'ReplicationGroups[0].PrimaryEndpoint.Port' `
  --output text

Write-Host "Redis Endpoint: $redisEndpoint`:$redisPort"
```

### Étape 3 : Mettre à jour Secrets Manager

```powershell
# Récupérer le secret actuel
$currentSecret = aws secretsmanager get-secret-value `
  --secret-id yukpomnang/backend/secrets `
  --region eu-west-1 `
  --query 'SecretString' `
  --output text | ConvertFrom-Json

# Mettre à jour REDIS_URL
$currentSecret.REDIS_URL = "redis://$redisEndpoint`:$redisPort"

# Sauvegarder dans un fichier temporaire
$currentSecret | ConvertTo-Json -Depth 10 | Out-File -FilePath secrets-updated.json -Encoding UTF8

# Mettre à jour le secret
aws secretsmanager update-secret `
  --secret-id yukpomnang/backend/secrets `
  --secret-string file://secrets-updated.json `
  --region eu-west-1

# Nettoyer
Remove-Item secrets-updated.json
```

### Étape 4 : Redémarrer le Service ECS

```powershell
# Forcer le redéploiement du service ECS pour prendre en compte le nouveau secret
aws ecs update-service `
  --cluster yukpomnang-cluster `
  --service yukpomnang-backend-service `
  --force-new-deployment `
  --region eu-west-1
```

### Étape 5 : Vérifier la Connexion

```powershell
# Vérifier les logs ECS pour confirmer la connexion Redis
aws logs tail /ecs/yukpomnang-backend `
  --follow `
  --region eu-west-1 `
  --filter-pattern "Redis"
```

**Rechercher** :
- ✅ `[Redis] Health check réussi`
- ✅ `[Redis] Connexion établie`
- ❌ `[Redis] Health check échoué` (si problème)

### Étape 6 : Vérifier les Performances

```powershell
# Vérifier les métriques ElastiCache
aws cloudwatch get-metric-statistics `
  --namespace AWS/ElastiCache `
  --metric-name CPUUtilization `
  --dimensions Name=ReplicationGroupId,Value=yukpomnang-redis `
  --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 300 `
  --statistics Average `
  --region eu-west-1
```

## 🔍 Vérifications Post-Migration

### 1. Vérifier que Redis fonctionne

```powershell
# Se connecter à une task ECS et tester Redis
aws ecs execute-command `
  --cluster yukpomnang-cluster `
  --task <task-id> `
  --container backend `
  --command "redis-cli -h $redisEndpoint -p $redisPort PING" `
  --interactive `
  --region eu-west-1
```

**Résultat attendu** : `PONG`

### 2. Vérifier les logs backend

Les logs ne devraient plus montrer :
- ❌ `Your database has been temporarily rate-limited`
- ❌ `Redis non disponible`

Mais plutôt :
- ✅ `[Redis] Health check réussi`
- ✅ `[Redis] Connexion active`

### 3. Vérifier les performances

- Latence Redis réduite
- Pas de rate limiting
- Workers fonctionnent normalement

## ⚠️ Problèmes Potentiels

### Problème 1 : Security Group bloque la connexion

**Symptôme** : Timeout lors de la connexion

**Solution** :
```powershell
# Vérifier que le Security Group ECS peut accéder à ElastiCache
aws ec2 describe-security-groups `
  --group-ids <ecs-security-group-id> `
  --region eu-west-1 `
  --query 'SecurityGroups[0].IpPermissions'
```

Le Security Group ECS doit avoir une règle sortante vers le port 6379 du Security Group ElastiCache.

### Problème 2 : ElastiCache dans un subnet différent

**Symptôme** : Impossible de se connecter

**Solution** : Vérifier que ElastiCache est dans les subnets privés accessibles depuis ECS.

## 📊 Comparaison Coûts

| Service | Coût/mois |
|---------|-----------|
| **Upstash Redis** (rate-limited) | ~$10-20 |
| **ElastiCache cache.t3.micro** | ~$5-8 |
| **Économie** | ~$5-12/mois |

## ✅ Checklist

- [ ] ElastiCache créé et actif
- [ ] Endpoint récupéré
- [ ] Secrets Manager mis à jour
- [ ] Service ECS redémarré
- [ ] Logs vérifiés (pas d'erreur Redis)
- [ ] Performances vérifiées
- [ ] Rate limiting éliminé

## 🎯 Résultat Attendu

Après migration :
- ✅ Plus d'erreurs de rate limiting Redis
- ✅ Workers fonctionnent normalement
- ✅ Latence réduite
- ✅ Infrastructure centralisée sur AWS

