# 🔧 Exécuter les migrations SQLx manuellement via ECS

## 🎯 Objectif

Exécuter les migrations SQLx manuellement dans le conteneur ECS pour créer toutes les tables manquantes.

## 📋 Prérequis

1. AWS CLI installé et configuré
2. Permissions pour exécuter des commandes ECS
3. Accès au cluster ECS et à la tâche

## 🔧 Étapes

### 1. Identifier la tâche ECS

```bash
# Lister les tâches en cours d'exécution
aws ecs list-tasks --cluster <nom-du-cluster>

# Exemple de sortie :
# {
#   "taskArns": [
#     "arn:aws:ecs:region:account:task/cluster/task-id"
#   ]
# }
```

### 2. Se connecter au conteneur

```bash
aws ecs execute-command \
  --cluster <nom-du-cluster> \
  --task <task-id> \
  --container <nom-du-container> \
  --command "/bin/bash" \
  --interactive
```

**Exemple complet** :
```bash
aws ecs execute-command \
  --cluster yukpomnang-cluster \
  --task abc123def456 \
  --container yukpomnang-backend \
  --command "/bin/bash" \
  --interactive
```

### 3. Vérifier l'environnement dans le conteneur

Une fois connecté au conteneur :

```bash
# Vérifier le working directory
pwd
# Devrait afficher : /app

# Vérifier que les migrations existent
ls -la /app/migrations/
# Devrait afficher la liste des fichiers .sql

# Vérifier la variable DATABASE_URL
echo $DATABASE_URL
# Devrait afficher la connexion PostgreSQL
```

### 4. Exécuter les migrations

```bash
# Aller dans le répertoire de l'application
cd /app

# Exécuter les migrations SQLx
sqlx migrate run

# OU si sqlx n'est pas installé dans le conteneur, utiliser le binaire Rust
# (si vous avez compilé sqlx-cli dans l'image)
/app/sqlx migrate run
```

### 5. Vérifier que les tables sont créées

```bash
# Se connecter à PostgreSQL (si psql est disponible)
psql $DATABASE_URL -c "\dt"

# OU via sqlx
sqlx query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

### 6. Vérifier les migrations appliquées

```bash
sqlx query "SELECT version, description, success FROM _sqlx_migrations ORDER BY version;"
```

## 🔍 Alternative : Utiliser un script dans le conteneur

Si vous avez un script de migration dans le conteneur :

```bash
# Exécuter le script
/app/scripts/run-migrations.sh

# OU directement via Rust
/app/yukpomnang_backend --migrate
```

## ⚠️ Notes importantes

1. **Permissions** : Assurez-vous que l'utilisateur PostgreSQL a les permissions `CREATE TABLE`
2. **Connexion** : Vérifiez que `DATABASE_URL` est correctement configurée
3. **Réseau** : Le conteneur doit pouvoir accéder à la base de données PostgreSQL
4. **Backup** : Faites un backup de la base de données avant d'exécuter les migrations

## 🚨 En cas d'erreur

### Erreur : "sqlx: command not found"

```bash
# Installer sqlx-cli dans le conteneur (temporaire)
cargo install sqlx-cli --features postgres

# OU utiliser le binaire compilé si disponible
```

### Erreur : "relation does not exist"

Cela signifie que les migrations ne s'exécutent pas. Vérifiez :
1. Que le dossier `/app/migrations/` existe
2. Que les fichiers `.sql` sont présents
3. Que `DATABASE_URL` est correcte

### Erreur : "permission denied"

Vérifiez les permissions PostgreSQL :
```sql
-- Se connecter en tant qu'admin PostgreSQL
GRANT ALL PRIVILEGES ON DATABASE yukpomnang TO yukpo_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO yukpo_user;
```

## ✅ Vérification post-migration

Après avoir exécuté les migrations, vérifiez dans les logs de l'application que les erreurs "relation does not exist" ont disparu.


