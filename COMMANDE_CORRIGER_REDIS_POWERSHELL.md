# 🔧 Commande PowerShell - Corriger Redis

## ✅ Commande Complète (Copier-Coller)

```powershell
# 1. Récupérer l'endpoint ElastiCache
$redisEndpoint = aws elasticache describe-replication-groups --replication-group-id yukpo-redis --region eu-west-1 --query 'ReplicationGroups[0].PrimaryEndpoint.Address' --output text

# 2. Construire l'URL Redis avec TLS
$newRedisUrl = "rediss://$redisEndpoint:6379/0"

Write-Host "🔍 Endpoint Redis: $redisEndpoint" -ForegroundColor Cyan
Write-Host "🔧 Nouvelle URL: $newRedisUrl" -ForegroundColor Yellow

# 3. Récupérer le secret actuel
$secretJson = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text

# 4. Parser le JSON
try {
    $secret = $secretJson | ConvertFrom-Json
} catch {
    Write-Host "⚠️ Erreur parsing JSON, tentative avec string simple..." -ForegroundColor Yellow
    $secret = @{ REDIS_URL = $secretJson }
}

# 5. Mettre à jour REDIS_URL
$secret.REDIS_URL = $newRedisUrl

# 6. Sauvegarder dans un fichier temporaire
$secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-redis-updated.json" -Encoding UTF8

# 7. Mettre à jour le secret
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret-redis-updated.json" -Raw)

Write-Host "✅ REDIS_URL mis à jour dans Secrets Manager" -ForegroundColor Green

# 8. Redémarrer ECS
Write-Host "🔄 Redémarrage du service ECS..." -ForegroundColor Yellow
aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment

Write-Host "✅ Service ECS redémarré. Attendez 2-3 minutes." -ForegroundColor Green
```


