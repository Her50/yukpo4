# Mise à jour REDIS_URL avec l'endpoint trouvé
$redisEndpoint = "master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com"
$newRedisUrl = "redis://$redisEndpoint:6379/0"

Write-Host "Mise à jour REDIS_URL..." -ForegroundColor Yellow
Write-Host "Endpoint: $redisEndpoint" -ForegroundColor Gray
Write-Host "REDIS_URL: $newRedisUrl" -ForegroundColor Gray
Write-Host ""

# Récupérer le secret actuel
$secret = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text | ConvertFrom-Json

# Vérifier la valeur actuelle
Write-Host "REDIS_URL actuel: $($secret.REDIS_URL)" -ForegroundColor Gray

if ($secret.REDIS_URL -ne $newRedisUrl) {
    # Mettre à jour
    $secret.REDIS_URL = $newRedisUrl
    $secret | ConvertTo-Json -Depth 10 | Out-File -FilePath "$env:TEMP\secret-redis.json" -Encoding UTF8
    aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string (Get-Content "$env:TEMP\secret-redis.json" -Raw) | Out-Null
    Write-Host "✅ REDIS_URL mis à jour: $newRedisUrl" -ForegroundColor Green
    
    # Redémarrer ECS
    Write-Host ""
    Write-Host "Redémarrage du service ECS..." -ForegroundColor Yellow
    aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment | Out-Null
    Write-Host "✅ Service ECS redémarré" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏱️  Attendez 2-3 minutes pour que le service redémarre complètement" -ForegroundColor Cyan
    Write-Host "Vérifiez les logs dans CloudWatch pour confirmer que Redis fonctionne" -ForegroundColor Cyan
} else {
    Write-Host "✅ REDIS_URL déjà correct" -ForegroundColor Green
}

