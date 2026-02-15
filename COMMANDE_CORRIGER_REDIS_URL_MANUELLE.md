# 🔴 Corriger REDIS_URL Manuellement

## ❌ **Problème**

Le REDIS_URL a été mis à jour avec une valeur incorrecte : `redis:///0` au lieu de `redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0`

## ✅ **Solution : Corriger via AWS CLI**

```powershell
# Récupérer le secret actuel
$secretString = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text

# Afficher pour voir le contenu
Write-Host "Secret actuel:" -ForegroundColor Yellow
Write-Host $secretString
Write-Host ""

# Parser le JSON
$secret = $secretString | ConvertFrom-Json

# Corriger REDIS_URL
$secret.REDIS_URL = "redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0"

# Convertir en JSON compact
$newSecret = $secret | ConvertTo-Json -Depth 10 -Compress

# Afficher pour vérification
Write-Host "Nouveau REDIS_URL: $($secret.REDIS_URL)" -ForegroundColor Green
Write-Host ""

# Sauvegarder dans un fichier
$newSecret | Out-File -FilePath "$env:TEMP\secret-fix.json" -Encoding UTF8 -NoNewline

# Mettre à jour
Write-Host "Mise à jour du secret..." -ForegroundColor Yellow
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string "file://$env:TEMP\secret-fix.json"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ REDIS_URL corrigé!" -ForegroundColor Green
    
    # Redémarrer ECS
    Write-Host ""
    Write-Host "Redémarrage ECS..." -ForegroundColor Yellow
    aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment | Out-Null
    Write-Host "✅ ECS redémarré" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
}
```

---

## ✅ **OU Via Console AWS (Plus Simple)**

1. Allez sur : https://console.aws.amazon.com/secretsmanager/
2. Sélectionnez : `yukpo/backend/secrets`
3. Cliquez sur "Modifier"
4. Trouvez `REDIS_URL` et modifiez en :
   ```
   redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0
   ```
5. Sauvegardez
6. Redémarrez ECS :
   ```powershell
   aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
   ```


