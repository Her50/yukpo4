# ✅ Solution Complète - Problème Redis

## 🔍 Problèmes Identifiés

1. **Timeout trop court** : 3 secondes par tentative (trop court pour ElastiCache)
2. **URL Redis incorrecte** : `redis://` au lieu de `rediss://` (ElastiCache utilise TLS)
3. **Secret AWS non mis à jour** : Le secret dans Secrets Manager utilise encore `redis://`

## ✅ Corrections Appliquées

### 1. **Timeout Redis Augmenté** (`backend/src/utils/redis_helper.rs`)
- ❌ **Avant** : 3 secondes par tentative
- ✅ **Après** : 10 secondes par tentative (max 30s au total)

### 2. **URL Redis dans Terraform** (`infra/aws/main.tf`)
- ❌ **Avant** : `redis://${endpoint}:6379`
- ✅ **Après** : `rediss://${endpoint}:6379/0` (TLS activé)

## 🚀 Actions Requises

### 1. Mettre à Jour le Secret AWS (IMMÉDIAT)

```powershell
# Récupérer l'endpoint ElastiCache
$redisEndpoint = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text

# Construire l'URL Redis avec TLS
$newRedisUrl = "rediss://$redisEndpoint:6379/0"

# Récupérer le secret actuel
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json

# Mettre à jour REDIS_URL
$secret.REDIS_URL = $newRedisUrl

# Sauvegarder dans un fichier temporaire
$secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-redis-updated.json" -Encoding UTF8

# Mettre à jour le secret
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret-redis-updated.json" -Raw)

Write-Host "✅ REDIS_URL mis à jour: $newRedisUrl" -ForegroundColor Green
```

### 2. Redémarrer ECS

```powershell
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
```

### 3. Commit et Push les Corrections

```bash
git add backend/src/utils/redis_helper.rs infra/aws/main.tf
git commit -m "fix: Augmenter timeout Redis (3s→10s) et corriger URL (redis→rediss pour TLS)"
git push
```

## 📊 Résultat Attendu

- ✅ Timeout Redis : 10 secondes par tentative (au lieu de 3s)
- ✅ URL Redis : `rediss://` avec TLS (au lieu de `redis://`)
- ✅ Connexions Redis réussies
- ✅ Plus d'erreurs "Connection timeout"

