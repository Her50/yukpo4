# 🚀 Guide : Exécuter les migrations SQLx manuellement dans AWS ECS

## 📋 Prérequis

1. **AWS CLI installé et configuré** :
   ```bash
   aws --version
   # Doit afficher : aws-cli/2.x.x
   
   # Vérifier la configuration
   aws configure list
   ```

2. **Permissions ECS** : Votre utilisateur AWS doit avoir les permissions :
   - `ecs:ListTasks`
   - `ecs:DescribeTasks`
   - `ecs:ExecuteCommand`

3. **Session Manager activé** : ECS Execute Command nécessite AWS Systems Manager Session Manager

## 🔧 Étapes détaillées

### Étape 1 : Identifier le nom du cluster

Le cluster ECS s'appelle : `<project_name>-cluster`

**Option A : Via Terraform** :
```bash
cd infra/aws
terraform output
# Cherchez le nom du cluster dans les outputs
```

**Option B : Via AWS Console** :
1. Aller sur AWS Console → ECS → Clusters
2. Trouver le cluster (probablement `yukpomnang-cluster` ou similaire)

**Option C : Lister tous les clusters** :
```bash
aws ecs list-clusters
```

### Étape 2 : Lister les tâches en cours d'exécution

```bash
# Remplacer <cluster-name> par le nom de votre cluster
aws ecs list-tasks --cluster <cluster-name>

# Exemple :
aws ecs list-tasks --cluster yukpomnang-cluster
```

**Sortie attendue** :
```json
{
    "taskArns": [
        "arn:aws:ecs:eu-central-1:123456789012:task/cluster-name/abc123def4567890"
    ]
}
```

**Extraire le task ID** :
- Le task ID est la dernière partie de l'ARN après le dernier `/`
- Exemple : `abc123def4567890`

### Étape 3 : Activer ECS Execute Command (si nécessaire)

Si vous obtenez une erreur "ExecuteCommand is not enabled", activez-le :

```bash
# Activer pour le cluster
aws ecs update-cluster \
  --cluster <cluster-name> \
  --enable-execute-command

# Exemple :
aws ecs update-cluster \
  --cluster yukpomnang-cluster \
  --enable-execute-command
```

**Vérifier** :
```bash
aws ecs describe-clusters --clusters <cluster-name> --include CONFIGURATIONS
# Cherchez "executeCommandConfiguration" dans la sortie
```

### Étape 4 : Se connecter au conteneur

```bash
aws ecs execute-command \
  --cluster <cluster-name> \
  --task <task-id> \
  --container backend \
  --command "/bin/bash" \
  --interactive
```

**Exemple complet** :
```bash
aws ecs execute-command \
  --cluster yukpomnang-cluster \
  --task abc123def4567890 \
  --container backend \
  --command "/bin/bash" \
  --interactive
```

**Note** : Si vous êtes sur Windows PowerShell, utilisez :
```powershell
aws ecs execute-command `
  --cluster yukpomnang-cluster `
  --task abc123def4567890 `
  --container backend `
  --command "/bin/bash" `
  --interactive
```

### Étape 5 : Vérifier l'environnement dans le conteneur

Une fois connecté au conteneur (vous devriez voir un prompt bash) :

```bash
# Vérifier le répertoire courant
pwd
# Devrait afficher : /app

# Vérifier que les migrations existent
ls -la /app/migrations/
# Devrait afficher la liste des fichiers .sql (0000_create_all_tables.sql, etc.)

# Vérifier la variable DATABASE_URL
echo $DATABASE_URL
# Devrait afficher la connexion PostgreSQL (masquée)
```

### Étape 6 : Exécuter les migrations

**Option A : Si sqlx-cli est installé dans le conteneur** :

```bash
cd /app
sqlx migrate run
```

**Option B : Si sqlx-cli n'est pas installé** :

Le conteneur utilise probablement `debian:trixie-slim` qui n'a pas sqlx-cli. Vous devez l'installer :

```bash
# Installer Rust et Cargo (si pas déjà installé)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# Installer sqlx-cli
cargo install sqlx-cli --features postgres --no-default-features

# Exécuter les migrations
cd /app
sqlx migrate run --database-url "$DATABASE_URL"
```

**Option C : Utiliser directement psql (si disponible)** :

```bash
# Vérifier si psql est disponible
which psql

# Si oui, exécuter les migrations manuellement
# (mais c'est plus complexe, préférez Option A ou B)
```

### Étape 7 : Vérifier que les migrations ont été appliquées

```bash
# Vérifier les migrations appliquées
sqlx query --database-url "$DATABASE_URL" \
  "SELECT version, description, success FROM _sqlx_migrations ORDER BY version;"

# Vérifier que les tables existent
sqlx query --database-url "$DATABASE_URL" \
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

**Tables attendues** :
- `users`
- `services`
- `deliveries`
- `product_creation_queue`
- `publicites`
- `pharmacies`
- `matching_offres_candidats`
- `live_flash_sales`
- `global_promo_events`
- `delivery_matching_queue`
- `product_orders`
- `video_generation_jobs`
- `social_publication_jobs`
- `delivery_proximity_suggestions`
- `_sqlx_migrations`

### Étape 8 : Quitter le conteneur

```bash
exit
```

## 🎯 Script complet (copier-coller)

Voici un script PowerShell complet pour Windows :

```powershell
# 1. Définir les variables
$CLUSTER_NAME = "yukpomnang-cluster"  # À adapter
$REGION = "eu-central-1"  # À adapter

# 2. Lister les tâches
Write-Host "🔍 Recherche des tâches en cours..." -ForegroundColor Cyan
$tasks = aws ecs list-tasks --cluster $CLUSTER_NAME --region $REGION | ConvertFrom-Json

if ($tasks.taskArns.Count -eq 0) {
    Write-Host "❌ Aucune tâche trouvée dans le cluster $CLUSTER_NAME" -ForegroundColor Red
    exit 1
}

# 3. Extraire le task ID
$taskArn = $tasks.taskArns[0]
$taskId = $taskArn.Split('/')[-1]
Write-Host "✅ Tâche trouvée : $taskId" -ForegroundColor Green

# 4. Activer Execute Command si nécessaire
Write-Host "🔧 Activation de Execute Command..." -ForegroundColor Cyan
aws ecs update-cluster --cluster $CLUSTER_NAME --enable-execute-command --region $REGION | Out-Null

# 5. Se connecter au conteneur
Write-Host "🚀 Connexion au conteneur..." -ForegroundColor Cyan
Write-Host "💡 Une fois connecté, exécutez : cd /app && sqlx migrate run" -ForegroundColor Yellow
Write-Host ""

aws ecs execute-command `
  --cluster $CLUSTER_NAME `
  --task $taskId `
  --container backend `
  --command "/bin/bash" `
  --interactive `
  --region $REGION
```

## 🚨 Résolution de problèmes

### Erreur : "ExecuteCommand is not enabled"

```bash
aws ecs update-cluster --cluster <cluster-name> --enable-execute-command
```

### Erreur : "Unable to start command"

Vérifiez que :
1. Le service ECS a `enableExecuteCommand = true`
2. Le rôle IAM de la tâche a les permissions Session Manager

### Erreur : "sqlx: command not found"

Installez sqlx-cli dans le conteneur (voir Option B ci-dessus).

### Erreur : "connection refused" ou "timeout"

Vérifiez que :
1. Le conteneur peut accéder à la base de données PostgreSQL
2. Les Security Groups permettent la connexion
3. `DATABASE_URL` est correcte

## ✅ Vérification post-migration

Après avoir exécuté les migrations :

1. **Vérifier les logs de l'application** :
   - Les erreurs "relation does not exist" devraient disparaître
   - Les services devraient fonctionner normalement

2. **Tester un endpoint** :
   ```bash
   curl https://votre-domaine.com/health
   ```

3. **Vérifier dans CloudWatch** :
   - Aller sur CloudWatch → Logs
   - Chercher le log group `/ecs/<project-name>-backend`
   - Vérifier qu'il n'y a plus d'erreurs de tables manquantes

## 📝 Notes importantes

1. **Backup** : Faites un backup de la base de données avant d'exécuter les migrations
2. **Downtime** : Les migrations peuvent prendre quelques secondes, mais ne devraient pas causer de downtime
3. **Permissions** : Assurez-vous que l'utilisateur PostgreSQL a les permissions `CREATE TABLE`
4. **Réseau** : Le conteneur doit pouvoir accéder à la base de données PostgreSQL

