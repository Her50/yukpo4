# 🔴 Vérifier et Configurer Redis depuis Windows

## ✅ **Commande PowerShell Complète**

Exécutez cette commande depuis PowerShell sur Windows :

```powershell
# Vérifier le statut et l'endpoint Redis
$redisStatus = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address]' --output table
Write-Host $redisStatus

# Récupérer l'endpoint
$redisEndpoint = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text

if ($redisEndpoint -and $redisEndpoint -ne "None" -and $redisEndpoint -ne "") {
    Write-Host "`n✅ Endpoint Redis trouvé: $redisEndpoint" -ForegroundColor Green
    
    # Mettre à jour REDIS_URL
    Write-Host "Mise à jour REDIS_URL..." -ForegroundColor Yellow
    $secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json
    $newRedisUrl = "redis://$redisEndpoint:6379/0"
    
    if ($secret.REDIS_URL -ne $newRedisUrl) {
        $secret.REDIS_URL = $newRedisUrl
        $secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-redis.json" -Encoding UTF8
        aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret-redis.json" -Raw) | Out-Null
        Write-Host "✅ REDIS_URL mis à jour: $newRedisUrl" -ForegroundColor Green
        
        # Redémarrer ECS
        Write-Host "Redémarrage ECS..." -ForegroundColor Yellow
        aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment | Out-Null
        Write-Host "✅ Service ECS redémarré (attendre 2-3 minutes)" -ForegroundColor Green
    } else {
        Write-Host "✅ REDIS_URL déjà correct" -ForegroundColor Green
    }
} else {
    Write-Host "`n⚠️  Endpoint Redis non disponible" -ForegroundColor Yellow
    Write-Host "Le cluster est peut-être en cours de création. Vérifiez le statut ci-dessus." -ForegroundColor Yellow
    Write-Host "`nPour vérifier manuellement:" -ForegroundColor Cyan
    Write-Host "  AWS Console > ElastiCache > Replication groups > yukpo-redis" -ForegroundColor White
}
```

---

## ✅ **Version Simplifiée (Une Ligne)**

```powershell
$redisEndpoint = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text; if ($redisEndpoint -and $redisEndpoint -ne "None") { $secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json; $secret.REDIS_URL = "redis://$redisEndpoint:6379/0"; $secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret.json" -Encoding UTF8; aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret.json" -Raw); aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment; Write-Host "✅ Redis configuré" -ForegroundColor Green } else { Write-Host "⚠️  Redis endpoint non disponible" -ForegroundColor Yellow }
```


