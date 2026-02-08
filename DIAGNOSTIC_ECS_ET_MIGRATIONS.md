# 🔍 Diagnostic ECS et Exécution des Migrations

## ❌ Problème identifié : Pourquoi aucune tâche ECS ne démarre

### Cause racine

Les tâches ECS démarrent mais **échouent immédiatement** avec l'erreur :

```
ResourceInitializationError: unable to pull secrets or registry auth: 
execution resource retrieval failed: unable to retrieve secrets from ssm: 
service call has been retried 1 time(s): operation error SSM: GetParameters, 
https response error StatusCode: 400, RequestID: ..., 
api error AccessDeniedException: User: arn:aws:sts::846505724644:assumed-role/yukpomnang-ecs-execution-role/... 
is not authorized to perform: ssm:GetParameters on resource: 
arn:aws:ssm:eu-west-1:846505724644:parameter/yukpomnang/production/DATABASE_URL 
because no identity-based policy allows the ssm:GetParameters action
```

### Analyse

1. **Task Definition** : `yukpomnang-backend:2` est configurée pour récupérer **22 secrets** depuis AWS Systems Manager (SSM) Parameter Store
2. **Rôle IAM** : `yukpomnang-ecs-execution-role` n'a **pas les permissions** `ssm:GetParameters`
3. **Résultat** : Les tâches ne peuvent pas démarrer car elles ne peuvent pas récupérer les variables d'environnement

### Secrets configurés dans la task definition

- `DATABASE_URL` (depuis SSM)
- `REDIS_URL` (depuis SSM)
- `JWT_SECRET` (depuis SSM)
- `OPENAI_API_KEY` (depuis SSM)
- Et 18 autres secrets...

## ✅ Solutions

### Solution 1 : Corriger les permissions IAM (Recommandée)

Ajouter les permissions SSM au rôle `yukpomnang-ecs-execution-role` :

```powershell
# Créer une politique IAM pour SSM
$policy = @{
    Version = "2012-10-17"
    Statement = @(
        @{
            Effect = "Allow"
            Action = @(
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:GetParametersByPath"
            )
            Resource = "arn:aws:ssm:eu-west-1:846505724644:parameter/yukpomnang/production/*"
        }
    )
} | ConvertTo-Json -Depth 10

# Créer la politique
aws iam create-policy `
    --policy-name yukpomnang-ecs-ssm-access `
    --policy-document $policy `
    --region eu-west-1

# Attacher la politique au rôle
aws iam attach-role-policy `
    --role-name yukpomnang-ecs-execution-role `
    --policy-arn arn:aws:iam::846505724644:policy/yukpomnang-ecs-ssm-access `
    --region eu-west-1
```

**OU** modifier Terraform pour ajouter ces permissions automatiquement.

### Solution 2 : Utiliser AWS Secrets Manager au lieu de SSM

La configuration Terraform utilise déjà Secrets Manager (`aws_secretsmanager_secret.backend_secrets`), mais la task definition utilise SSM. 

**Option A** : Modifier la task definition pour utiliser Secrets Manager :
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

**Option B** : Synchroniser les secrets SSM depuis Secrets Manager (script à créer).

### Solution 3 : Exécuter les migrations via une tâche one-shot sans secrets

Créer une nouvelle task definition simplifiée qui :
- N'utilise pas de secrets SSM
- Reçoit `DATABASE_URL` directement en variable d'environnement
- Exécute uniquement les migrations

**Limitation** : Nécessite de créer une nouvelle task definition.

## 🚀 Exécution des migrations

### Méthode actuelle (dans le code)

L'application exécute **automatiquement** les migrations au démarrage (ligne 463 de `main.rs`) :

```rust
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
        // ...
    }
    Err(e) => {
        log::error!("❌ ERREUR lors de l'application des migrations: {}", e);
        // ...
    }
}
```

**Problème** : Les tâches ne peuvent pas démarrer à cause des permissions SSM, donc les migrations ne s'exécutent jamais.

### Solution immédiate : Corriger les permissions IAM

Une fois les permissions corrigées :

1. **Redémarrer le service ECS** :
```powershell
aws ecs update-service `
    --cluster yukpomnang-cluster `
    --service yukpomnang-backend-service `
    --force-new-deployment `
    --region eu-west-1
```

2. **Surveiller les tâches** :
```powershell
aws ecs list-tasks `
    --cluster yukpomnang-cluster `
    --service-name yukpomnang-backend-service `
    --desired-status RUNNING `
    --region eu-west-1
```

3. **Vérifier les logs CloudWatch** :
```powershell
aws logs tail /ecs/yukpomnang-backend `
    --region eu-west-1 `
    --since 10m `
    --format short
```

4. **Chercher dans les logs** :
   - `✅ Migrations SQLx standard appliquées avec succès`
   - `✅ Tables de base (users, services) vérifiées après migrations SQLx`

## 📋 Vérification post-migration

Une fois les migrations exécutées, vérifier dans la base de données :

```sql
-- Vérifier les migrations appliquées
SELECT version, description, success 
FROM _sqlx_migrations 
ORDER BY version;

-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

## 🔧 Actions recommandées

1. **Immédiat** : Corriger les permissions IAM pour SSM (Solution 1)
2. **Court terme** : Aligner la task definition avec Secrets Manager (Solution 2)
3. **Long terme** : Mettre à jour Terraform pour gérer automatiquement les permissions IAM

## 📝 Notes

- Les migrations sont **idempotentes** : elles peuvent être exécutées plusieurs fois sans risque
- Les health checks échouent probablement car l'application ne peut pas démarrer sans les variables d'environnement
- Une fois les permissions corrigées, les tâches devraient démarrer et les migrations s'exécuter automatiquement







