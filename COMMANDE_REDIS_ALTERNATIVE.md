# 🔴 Mise à Jour REDIS_URL - Alternative

## ✅ **Si le secret n'est pas au format JSON**

Le secret peut être stocké comme une chaîne simple. Utilisez cette méthode alternative :

### Option 1 : Via AWS Console (Recommandé)

1. Allez sur : https://console.aws.amazon.com/secretsmanager/
2. Sélectionnez : `yukpo/backend/secrets`
3. Cliquez sur "Modifier"
4. Trouvez `REDIS_URL` et modifiez sa valeur en :
   ```
   redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0
   ```
5. Sauvegardez
6. Redémarrez ECS :
   ```powershell
   aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --region eu-west-1 --force-new-deployment
   ```

---

### Option 2 : Via AWS CLI avec JSON brut

```powershell
# Récupérer le secret actuel
$secretString = aws secretsmanager get-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --query 'SecretString' --output text

# Afficher pour voir le format
Write-Host $secretString

# Si c'est du JSON, mettre à jour
$secret = $secretString | ConvertFrom-Json
$secret.REDIS_URL = "redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0"
$newSecret = $secret | ConvertTo-Json -Depth 10 -Compress

# Mettre à jour
aws secretsmanager put-secret-value --secret-id yukpo/backend/secrets --region eu-west-1 --secret-string $newSecret
```

---

### Option 3 : Script Corrigé

Exécutez le script corrigé :

```powershell
.\COMMANDE_MISE_A_JOUR_REDIS_CORRIGEE.ps1
```


