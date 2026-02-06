# 🚀 Exécution des migrations depuis l'environnement local

## 📋 Situation actuelle

- ✅ **Cluster ECS** : `yukpomnang-cluster` existe
- ✅ **Service ECS** : `yukpomnang-backend-service` existe
- ❌ **Tâches ECS** : Aucune tâche en cours d'exécution (`runningCount: 0`)
- ❌ **RDS** : Dans un subnet privé (non accessible depuis l'extérieur)
- ✅ **sqlx-cli** : Installé localement (version 0.8.6)
- ✅ **DATABASE_URL** : Récupérée depuis AWS Secrets Manager

## ❌ Pourquoi l'exécution locale ne fonctionne pas

La base de données RDS est dans un **subnet privé** du VPC AWS, ce qui signifie :
- Elle n'a pas d'IP publique
- Elle n'est accessible que depuis l'intérieur du VPC (via ECS, Lambda, etc.)
- Même avec le security group autorisé, l'accès depuis l'extérieur est impossible

C'est une **bonne pratique de sécurité** pour protéger la base de données.

## ✅ Solutions disponibles

### Option 1 : Exécuter via ECS Exec (Recommandée)

**Prérequis** : Le service ECS doit avoir au moins une tâche en cours d'exécution.

#### Étape 1 : Démarrer le service ECS

```powershell
# Vérifier pourquoi les tâches ne démarrent pas
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region eu-west-1 `
  --query "services[0].events[0:5]"

# Si nécessaire, forcer un nouveau déploiement
aws ecs update-service `
  --cluster yukpomnang-cluster `
  --service yukpomnang-backend-service `
  --force-new-deployment `
  --region eu-west-1
```

#### Étape 2 : Attendre qu'une tâche démarre

```powershell
# Surveiller les tâches
aws ecs list-tasks `
  --cluster yukpomnang-cluster `
  --service-name yukpomnang-backend-service `
  --region eu-west-1 `
  --desired-status RUNNING
```

#### Étape 3 : Utiliser le script existant

```powershell
.\scripts\executer-migrations-ecs.ps1
```

Ou manuellement :

```powershell
# Récupérer l'ARN d'une tâche
$taskArn = aws ecs list-tasks `
  --cluster yukpomnang-cluster `
  --service-name yukpomnang-backend-service `
  --region eu-west-1 `
  --desired-status RUNNING `
  --query 'taskArns[0]' `
  --output text

# Activer Execute Command
aws ecs update-cluster `
  --cluster yukpomnang-cluster `
  --enable-execute-command `
  --region eu-west-1

# Se connecter au conteneur
aws ecs execute-command `
  --cluster yukpomnang-cluster `
  --task $taskArn `
  --container backend `
  --command "/bin/bash" `
  --interactive `
  --region eu-west-1
```

#### Étape 4 : Dans le shell ECS, exécuter les migrations

```bash
# Vérifier l'environnement
pwd
ls -la /app/migrations/
echo $DATABASE_URL

# Installer sqlx-cli si nécessaire (peut prendre 5-10 minutes)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
cargo install sqlx-cli --features postgres --no-default-features

# Exécuter les migrations
cd /app
sqlx migrate run --database-url "$DATABASE_URL"

# Vérifier les migrations appliquées
sqlx query --database-url "$DATABASE_URL" \
  "SELECT version, description, success FROM _sqlx_migrations ORDER BY version;"

# Quitter
exit
```

### Option 2 : Créer une tâche ECS one-shot

Cette option nécessite :
- Une task definition existante
- Les IDs des subnets et security groups

```powershell
# Récupérer la task definition
$taskDef = aws ecs describe-task-definition `
  --task-definition yukpomnang-backend `
  --region eu-west-1 `
  --query 'taskDefinition.taskDefinitionArn' `
  --output text

# Récupérer les subnets (remplacer par vos IDs réels)
$subnets = "subnet-xxx,subnet-yyy"
$securityGroups = "sg-0934fdddd3b31b8d0"

# Créer une tâche one-shot
aws ecs run-task `
  --cluster yukpomnang-cluster `
  --task-definition $taskDef `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$subnets],securityGroups=[$securityGroups],assignPublicIp=DISABLED}" `
  --overrides '{"containerOverrides":[{"name":"backend","command":["/bin/bash","-c","cd /app && sqlx migrate run --database-url \"$DATABASE_URL\""]}]}' `
  --region eu-west-1
```

### Option 3 : Utiliser AWS Systems Manager Session Manager (Bastion)

Si vous avez un bastion host dans le VPC :

```powershell
# Se connecter au bastion
aws ssm start-session `
  --target i-xxxxx `
  --region eu-west-1

# Depuis le bastion, exécuter les migrations
cd /path/to/backend
sqlx migrate run
```

## 🔍 Diagnostic : Pourquoi les tâches ECS ne démarrent pas ?

Vérifiez les événements du service :

```powershell
aws ecs describe-services `
  --cluster yukpomnang-cluster `
  --services yukpomnang-backend-service `
  --region eu-west-1 `
  --query "services[0].events[0:10]"
```

Causes possibles :
- **Manque de ressources** : CPU/Mémoire insuffisants
- **Problème de réseau** : Subnets ou security groups incorrects
- **Erreur de configuration** : Task definition invalide
- **Problème d'image** : Image Docker non trouvée dans ECR

## 📝 Notes importantes

1. **Sécurité** : La base de données est correctement protégée dans un subnet privé
2. **Migrations idempotentes** : Les migrations SQLx sont idempotentes, vous pouvez les exécuter plusieurs fois sans risque
3. **Backup** : Faites un backup de la base de données avant d'exécuter les migrations en production
4. **Monitoring** : Surveillez les logs CloudWatch après l'exécution

## ✅ Vérification post-migration

Après avoir exécuté les migrations :

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

Tables attendues :
- `users`
- `services`
- `deliveries`
- `product_creation_queue`
- `delivery_matching_queue`
- `global_promo_events`
- `live_flash_sales`
- `product_orders`
- `video_generation_jobs`
- `social_publication_jobs`
- `delivery_proximity_suggestions`
- `publicites`
- `_sqlx_migrations`





