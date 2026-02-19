# 🔴 Mise à Jour REDIS_URL - Commande Simple

## ✅ **Commande PowerShell (Copier-Coller)**

```powershell
$redisEndpoint = "master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com"
$newRedisUrl = "redis://$redisEndpoint:6379/0"
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
$secret.REDIS_URL = $newRedisUrl
$secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret.json" -Encoding UTF8
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret.json" -Raw)
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
Write-Host "✅ REDIS_URL mis à jour et ECS redémarré" -ForegroundColor Green
```

---

## ✅ **OU Exécutez le Script**

```powershell
.\COMMANDE_MISE_A_JOUR_REDIS_URL.ps1
```

---

## ✅ **Vérification Après Redémarrage**

Attendez 2-3 minutes, puis vérifiez les logs CloudWatch :

```powershell
# Vérifier que le service est stable
aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region eu-west-1 --query 'services[0].[status,runningCount,desiredCount]' --output table
```

Les erreurs Redis devraient disparaître dans les logs.



