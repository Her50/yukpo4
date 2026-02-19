# 🔒 Corriger Redis avec TLS (Encryption en Transit)

## ❌ **Problème Identifié**

ElastiCache a `transit_encryption_enabled = true` dans Terraform, ce qui signifie que Redis utilise **TLS**. Il faut donc utiliser `rediss://` (avec deux 's') au lieu de `redis://`.

---

## ✅ **Commande de Correction**

```powershell
# Récupérer l'endpoint
$redisEndpoint = "master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com"

# Utiliser rediss:// pour TLS
$newRedisUrl = "rediss://$redisEndpoint:6379/0"

# Mettre à jour le secret
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
$secret.REDIS_URL = $newRedisUrl
$secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-redis-tls.json" -Encoding UTF8
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret-redis-tls.json" -Raw)

# Redémarrer ECS
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment

Write-Host "✅ REDIS_URL corrigé avec TLS: $newRedisUrl" -ForegroundColor Green
Write-Host "⏱️  Attendez 2-3 minutes pour que le service redémarre" -ForegroundColor Yellow
```

---

## ✅ **Vérification**

Après 2-3 minutes, vérifiez les logs. Les erreurs Redis devraient disparaître.



