# 🚀 Guide : Exécution Manuelle des Migrations Manquantes

## 📋 Résumé

Les tables suivantes sont manquantes dans la base de données AWS :
- `product_creation_queue`
- `live_flash_sales`
- `global_promo_events`
- `delivery_matching_queue`
- `product_orders`
- `social_publication_jobs`
- `video_generation_jobs`
- `deliveries` (et dépendances)

**Cause** : La migration 0 (`0000_create_all_tables.sql`) s'est arrêtée partiellement entre la ligne 110 et 1800.

## ✅ Solution : Utiliser les Migrations Séparées

Toutes ces tables ont des migrations dédiées qui utilisent `CREATE TABLE IF NOT EXISTS`, donc elles peuvent être exécutées même si la migration 0 a partiellement échoué.

## 🔧 Méthodes d'Exécution

### Méthode 1 : Script SQL Combiné (RECOMMANDÉ - Le Plus Simple)

**Fichier généré** : `combined_migrations_YYYYMMDDHHMMSS.sql`

Ce fichier contient toutes les migrations manquantes dans le bon ordre.

#### Option A : Depuis un serveur accessible à RDS

```bash
# Récupérer DATABASE_URL depuis SSM
DATABASE_URL=$(aws ssm get-parameter \
    --name "/yukpomnang/production/DATABASE_URL" \
    --region us-east-1 \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text)

# Exécuter le script SQL
psql "$DATABASE_URL" -f combined_migrations_20260129124506.sql
```

#### Option B : Depuis un conteneur ECS (via AWS CLI)

```bash
# 1. Trouver une tâche ECS en cours d'exécution
TASK_ARN=$(aws ecs list-tasks \
    --cluster yukpomnang-cluster \
    --service-name yukpomnang-backend \
    --region us-east-1 \
    --query 'taskArns[0]' \
    --output text)

# 2. Copier le fichier SQL dans le conteneur (si nécessaire)
aws ecs execute-command \
    --cluster yukpomnang-cluster \
    --task "$TASK_ARN" \
    --container backend \
    --interactive \
    --command "bash"

# 3. Dans le conteneur, exécuter :
psql "$DATABASE_URL" -f /app/combined_migrations_20260129124506.sql
```

#### Option C : Depuis GitHub Actions / CI/CD

Ajoutez une étape dans votre pipeline :

```yaml
- name: Execute missing migrations
  run: |
    DATABASE_URL=$(aws ssm get-parameter \
        --name "/yukpomnang/production/DATABASE_URL" \
        --region us-east-1 \
        --with-decryption \
        --query 'Parameter.Value' \
        --output text)
    psql "$DATABASE_URL" -f combined_migrations_20260129124506.sql
```

### Méthode 2 : Utiliser sqlx migrate run (RECOMMANDÉ - Le Plus Robuste)

Cette méthode utilise SQLx pour gérer les migrations automatiquement.

#### Depuis un conteneur ECS

```bash
# Utiliser le script existant
./scripts/run-migrations-from-ecs.sh
```

Ou manuellement :

```bash
# 1. Récupérer DATABASE_URL
DATABASE_URL=$(aws ssm get-parameter \
    --name "/yukpomnang/production/DATABASE_URL" \
    --region us-east-1 \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text)

# 2. Installer sqlx-cli si nécessaire
cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features postgres

# 3. Exporter DATABASE_URL
export DATABASE_URL

# 4. Aller dans le dossier backend
cd backend

# 5. Vérifier l'état des migrations
sqlx migrate info

# 6. Exécuter les migrations
sqlx migrate run
```

#### Depuis une tâche ECS one-shot

```bash
aws ecs run-task \
    --cluster yukpomnang-cluster \
    --task-definition yukpomnang-backend \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
    --overrides '{"containerOverrides":[{"name":"backend","command":["bash","-c","cd /app/backend && export DATABASE_URL=$(aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region us-east-1 --with-decryption --query Parameter.Value --output text) && sqlx migrate run"]}]}'
```

### Méthode 3 : Exécution Manuelle Table par Table

Si vous préférez exécuter les migrations une par une :

```bash
# Récupérer DATABASE_URL
DATABASE_URL=$(aws ssm get-parameter \
    --name "/yukpomnang/production/DATABASE_URL" \
    --region us-east-1 \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text)

# Exécuter chaque migration dans l'ordre
psql "$DATABASE_URL" -f backend/migrations/20260102_create_product_creation_queue.sql
psql "$DATABASE_URL" -f backend/migrations/20251111001_002_create_live_flash_sales.sql
psql "$DATABASE_URL" -f backend/migrations/20251115002_create_global_promo_platform.sql
psql "$DATABASE_URL" -f backend/migrations/20251115001_create_delivery_matching_tables.sql
psql "$DATABASE_URL" -f backend/migrations/20250120_001_add_order_preparation_system.sql
```

## 📊 Vérification Post-Migration

Après avoir exécuté les migrations, vérifiez que toutes les tables existent :

```sql
-- Vérifier les tables critiques
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'product_creation_queue',
    'live_flash_sales',
    'global_promo_events',
    'delivery_matching_queue',
    'product_orders',
    'deliveries',
    'social_publication_jobs',
    'video_generation_jobs'
)
ORDER BY table_name;
```

Toutes les tables doivent apparaître dans la liste.

## 🔍 Ordre des Migrations

Les migrations doivent être exécutées dans cet ordre pour respecter les dépendances :

1. **Tables de base** (déjà créées) :
   - `users`
   - `services`

2. **Tables de dépendance** (à créer si manquantes) :
   - `live_sessions` (nécessaire pour `live_flash_sales`)
   - `couriers` (nécessaire pour `deliveries`)
   - `delivery_parcels` (nécessaire pour `deliveries`)
   - `parcel_types` (nécessaire pour `delivery_parcels`)
   - `delivery_zones` (nécessaire pour `delivery_matching_queue`)

3. **Tables principales** :
   - `deliveries` (si manquante)
   - `product_creation_queue`
   - `live_flash_sales`
   - `global_promo_events`
   - `delivery_matching_queue`
   - `product_orders`

## ⚠️ Notes Importantes

1. **Toutes les migrations utilisent `CREATE TABLE IF NOT EXISTS`** : Elles peuvent être exécutées plusieurs fois sans erreur.

2. **Les migrations sont idempotentes** : Elles peuvent être réexécutées en toute sécurité.

3. **Vérifiez les logs** : Après exécution, vérifiez les logs de l'application pour confirmer que les erreurs "relation does not exist" ont disparu.

4. **Backup recommandé** : Avant d'exécuter les migrations, faites un backup de la base de données :
   ```bash
   pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

## 🎯 Méthode Recommandée

**Pour une exécution rapide et fiable, utilisez la Méthode 1 (Script SQL Combiné)** :

1. Le fichier `combined_migrations_YYYYMMDDHHMMSS.sql` contient tout ce qu'il faut
2. Il peut être exécuté en une seule commande
3. Il respecte l'ordre des dépendances
4. Il utilise `CREATE TABLE IF NOT EXISTS` donc il est sûr à réexécuter

```bash
psql "$DATABASE_URL" -f combined_migrations_20260129124506.sql
```

## 📝 Fichiers Créés

- ✅ `combined_migrations_20260129124506.sql` - Script SQL combiné avec toutes les migrations
- ✅ `scripts/executer_migrations_simple.ps1` - Script PowerShell pour générer le fichier combiné
- ✅ `scripts/run-migrations-from-ecs.sh` - Script bash pour exécuter via ECS
- ✅ `GUIDE_EXECUTION_MIGRATIONS_MANQUANTES.md` - Ce guide

