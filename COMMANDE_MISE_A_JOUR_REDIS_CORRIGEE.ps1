# Mise à jour REDIS_URL - Version Corrigée
$redisEndpoint = "master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com"
$newRedisUrl = "redis://${redisEndpoint}:6379/0"

Write-Host "Mise à jour REDIS_URL..." -ForegroundColor Yellow
Write-Host "Endpoint: $redisEndpoint" -ForegroundColor Gray
Write-Host "REDIS_URL: $newRedisUrl" -ForegroundColor Gray
Write-Host ""

# Vérification
if ($newRedisUrl -eq "redis://:6379/0" -or $newRedisUrl -eq "redis:///0") {
    Write-Host "ERREUR: L'endpoint Redis est vide!" -ForegroundColor Red
    Write-Host "Vérifiez que la variable redisEndpoint est correctement définie" -ForegroundColor Yellow
    exit 1
}

# Récupérer le secret actuel
$secretString = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text

# Vérifier si c'est du JSON ou une chaîne simple
try {
    $secret = $secretString | ConvertFrom-Json
    $isJson = $true
} catch {
    # Si ce n'est pas du JSON, créer un objet JSON
    Write-Host "Le secret n'est pas au format JSON, création d'un objet JSON..." -ForegroundColor Yellow
    $secret = @{}
    $isJson = $false
}

# Si ce n'est pas du JSON, essayer de parser comme JSON multiligne
if (-not $isJson) {
    try {
        # Essayer de parser comme JSON valide
        $secret = $secretString | ConvertFrom-Json -ErrorAction Stop
        $isJson = $true
    } catch {
        # Créer un objet vide
        $secret = @{}
    }
}

# Vérifier la valeur actuelle
if ($secret.REDIS_URL) {
    Write-Host "REDIS_URL actuel: $($secret.REDIS_URL)" -ForegroundColor Gray
} else {
    Write-Host "REDIS_URL n'existe pas encore dans le secret" -ForegroundColor Yellow
}

# Mettre à jour REDIS_URL
$secret.REDIS_URL = $newRedisUrl

# Convertir en JSON
$secretJson = $secret | ConvertTo-Json -Depth 10 -Compress

# Sauvegarder dans un fichier temporaire
$tempFile = "$env:TEMP\secret-redis-update.json"
$secretJson | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "Mise à jour du secret dans Secrets Manager..." -ForegroundColor Yellow

# Mettre à jour le secret
$result = aws secretsmanager put-secret-value `
    --secret-id yukpo/backend/secrets `
    --region eu-west-1 `
    --secret-string "file://$tempFile" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ REDIS_URL mis à jour: $newRedisUrl" -ForegroundColor Green
    
    # Redémarrer ECS
    Write-Host ""
    Write-Host "Redémarrage du service ECS..." -ForegroundColor Yellow
    aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment | Out-Null
    Write-Host "✅ Service ECS redémarré" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏱️  Attendez 2-3 minutes pour que le service redémarre complètement" -ForegroundColor Cyan
} else {
    Write-Host "❌ Erreur lors de la mise à jour: $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "Essayez avec cette commande alternative:" -ForegroundColor Yellow
    Write-Host "aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string '$secretJson'" -ForegroundColor White
}

# Nettoyer
Remove-Item $tempFile -ErrorAction SilentlyContinue

