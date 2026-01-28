# Instructions pour exécuter les migrations depuis ECS

## ✅ Actions effectuées

1. **ECS Exec activé** sur le service `yukpomnang-backend-service`
2. **Nouveau déploiement forcé** pour créer des tâches avec ECS Exec activé
3. **Scripts créés** pour faciliter l'exécution des migrations

## 🚀 Exécution des migrations depuis ECS

### Option A : Via AWS CLI avec Session Manager Plugin

1. **Installer le plugin Session Manager** (si pas déjà installé) :
   ```powershell
   # Windows
   winget install Amazon.SessionManagerPlugin
   
   # Ou télécharger depuis :
   # https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
   ```

2. **Se connecter à une tâche ECS** :
   ```powershell
   # Récupérer l'ARN d'une tâche
   $taskArn = aws ecs list-tasks `
     --cluster yukpomnang-cluster `
     --service-name yukpomnang-backend-service `
     --region us-east-1 `
     --desired-status RUNNING `
     --query 'taskArns[0]' `
     --output text
   
   # Se connecter à la tâche
   aws ecs execute-command `
     --cluster yukpomnang-cluster `
     --task $taskArn `
     --container backend `
     --command /bin/bash `
     --interactive `
     --region us-east-1
   ```

3. **Dans le shell ECS, exécuter** :
   ```bash
   cd /app/backend
   sqlx migrate info
   sqlx migrate run
   ```

### Option B : Créer une tâche ECS one-shot

Créer un fichier `run-migrations-task.json` :

```json
{
  "containerOverrides": [
    {
      "name": "backend",
      "command": [
        "/bin/bash",
        "-c",
        "cd /app/backend && sqlx migrate info && sqlx migrate run"
      ]
    }
  ]
}
```

Puis exécuter :

```powershell
aws ecs run-task `
  --cluster yukpomnang-cluster `
  --task-definition yukpomnang-backend:3 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5],securityGroups=[sg-0f9210abfa33d52d4],assignPublicIp=ENABLED}" `
  --overrides file://run-migrations-task.json `
  --region us-east-1
```

### Option C : Via AWS Console

1. Aller dans **ECS Console** → **Clusters** → `yukpomnang-cluster`
2. Cliquer sur **Tasks** → Sélectionner une tâche en cours d'exécution
3. Cliquer sur **Execute Command** → **Execute**
4. Dans le terminal, exécuter :
   ```bash
   cd /app/backend
   sqlx migrate info
   sqlx migrate run
   ```

## 📋 Vérification après exécution

Vérifier que les tables ont été créées :

```bash
# Dans le shell ECS
psql $DATABASE_URL -c "\dt" | grep -E "(product_creation_queue|deliveries|delivery_matching_queue|global_promo_events|live_flash_sales|social_publication_jobs)"
```

Ou utiliser le script de vérification :

```bash
bash scripts/check-migrations-status-ecs.sh
```

## 🔄 Après les migrations SQLx

1. **Vérifier ENABLE_AUTO_MIGRATIONS** :
   ```powershell
   .\scripts\check-enable-auto-migrations.ps1
   ```

2. **Si nécessaire, redémarrer l'application** pour exécuter les migrations automatiques :
   ```powershell
   aws ecs update-service `
     --cluster yukpomnang-cluster `
     --service yukpomnang-backend-service `
     --force-new-deployment `
     --region us-east-1
   ```

3. **Vérifier les logs CloudWatch** pour confirmer l'exécution des migrations automatiques :
   - Chercher : `🔄 Exécution des migrations automatiques (ENABLE_AUTO_MIGRATIONS=true)...`
   - Chercher : `✅ Migration auto: ...`

## ⚠️ Notes importantes

- Les migrations SQLx sont **idempotentes** : les migrations déjà appliquées seront ignorées
- La base de données est dans un **VPC privé**, donc l'accès depuis l'extérieur nécessite un VPN ou un bastion host
- ECS Exec nécessite le **plugin Session Manager** installé localement
- Les nouvelles tâches créées après l'activation d'ECS Exec auront cette fonctionnalité disponible

