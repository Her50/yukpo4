# 📋 Résumé Final : Diagnostic et Solutions pour les Migrations

## ✅ Actions Réalisées

1. **Diagnostic complet** : Identifié que les tâches ECS ne démarrent pas à cause de permissions IAM manquantes
2. **Permissions IAM corrigées** : 
   - Créé la politique `yukpomnang-ecs-ssm-access`
   - Attaché au rôle `yukpomnang-ecs-execution-role`
3. **Problème de Target Group identifié** : Le service référence un target group qui n'existe plus
4. **Tentatives de tâches one-shot** : Créées mais échouent toujours

## ❌ Problèmes Restants

### Problème Principal : Secrets SSM vs Variables d'Environnement

La task definition `yukpomnang-backend:2` est configurée pour récupérer **22 secrets depuis SSM Parameter Store**. Même si on ajoute des variables d'environnement dans les overrides, les secrets SSM sont toujours requis au démarrage de la tâche.

**Erreur typique** :
```
ResourceInitializationError: unable to pull secrets or registry auth: 
execution resource retrieval failed: unable to retrieve secrets from ssm
```

### Solutions Possibles

#### Solution 1 : Vérifier que les secrets SSM existent

Les secrets doivent exister dans SSM Parameter Store :

```powershell
# Vérifier si les secrets existent
aws ssm get-parameter `
    --name /yukpomnang/production/DATABASE_URL `
    --region eu-west-1 `
    --query "Parameter.Value" `
    --output text
```

Si les secrets n'existent pas, les créer depuis Secrets Manager :

```powershell
# Récupérer depuis Secrets Manager
$secrets = aws secretsmanager get-secret-value `
    --secret-id yukpomnang/backend/secrets `
    --region eu-west-1 `
    --query "SecretString" `
    --output text | ConvertFrom-Json

# Créer dans SSM
aws ssm put-parameter `
    --name /yukpomnang/production/DATABASE_URL `
    --value $secrets.DATABASE_URL `
    --type SecureString `
    --region eu-west-1
```

#### Solution 2 : Modifier la task definition pour utiliser Secrets Manager

Au lieu de SSM, utiliser Secrets Manager (déjà configuré dans Terraform) :

```json
{
  "secrets": [
    {
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:secretsmanager:eu-west-1:846505724644:secret:yukpomnang/backend/secrets:DATABASE_URL::"
    }
  ]
}
```

#### Solution 3 : Créer une nouvelle task definition simplifiée pour les migrations

Créer une task definition qui :
- N'utilise pas de secrets SSM
- Reçoit uniquement `DATABASE_URL` en variable d'environnement
- Exécute uniquement les migrations

## 🎯 Solution Recommandée : Synchroniser les Secrets

La solution la plus rapide est de **synchroniser les secrets depuis Secrets Manager vers SSM Parameter Store**, car :
1. Les permissions IAM sont déjà corrigées
2. La task definition est déjà configurée pour SSM
3. Pas besoin de modifier la task definition

### Script de Synchronisation

```powershell
# Récupérer tous les secrets depuis Secrets Manager
$secrets = aws secretsmanager get-secret-value `
    --secret-id yukpomnang/backend/secrets `
    --region eu-west-1 `
    --query "SecretString" `
    --output text | ConvertFrom-Json

# Liste des secrets à synchroniser
$secretNames = @(
    "DATABASE_URL", "REDIS_URL", "JWT_SECRET", "OPENAI_API_KEY",
    "SORA_API_KEY", "LIVEKIT_API_SECRET", "S3_SECRET_KEY", "S3_ACCESS_KEY",
    "MONGODB_URL", "SENDGRID_API_KEY", "TWILIO_AUTH_TOKEN", "AUPHONIC_API_KEY",
    "VIDEO_RENDERER_RPC_TOKEN", "EMBEDDING_API_KEY", "YUKPO_API_KEY",
    "GOOGLE_MAPS_API_KEY", "GOOGLE_TRANSLATE_API_KEY", "PEXELS_API_KEY",
    "PIXABAY_API_KEY", "UNSPLASH_ACCESS_KEY", "OPENWEATHERMAP_API_KEY",
    "YOUTUBE_CLIENT_SECRET"
)

# Synchroniser chaque secret
foreach ($name in $secretNames) {
    if ($secrets.$name) {
        Write-Host "Synchronisation de $name..." -ForegroundColor Cyan
        aws ssm put-parameter `
            --name "/yukpomnang/production/$name" `
            --value $secrets.$name `
            --type SecureString `
            --overwrite `
            --region eu-west-1 `
            --no-cli-pager
    }
}
```

## 📝 Prochaines Étapes

1. **Synchroniser les secrets** depuis Secrets Manager vers SSM
2. **Redémarrer le service ECS** ou créer une nouvelle tâche one-shot
3. **Surveiller les logs** pour confirmer l'exécution des migrations
4. **Vérifier dans la base de données** que les tables ont été créées

## 🔍 Vérification

Une fois les secrets synchronisés et les tâches démarrées :

```powershell
# Vérifier les logs
aws logs tail /ecs/yukpomnang-backend `
    --region eu-west-1 `
    --since 10m `
    --format short `
    --filter-pattern "Migrations"
```

Chercher :
- `✅ Migrations SQLx standard appliquées avec succès`
- `✅ Tables de base (users, services) vérifiées après migrations SQLx`


