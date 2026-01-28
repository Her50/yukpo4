# 🔧 Dépannage : Tables manquantes dans la base de données

## Problème

Les logs CloudWatch montrent des erreurs indiquant que plusieurs tables n'existent pas :
- `product_creation_queue`
- `deliveries`
- `delivery_matching_queue`
- `delivery_proximity_suggestions`
- `product_orders`
- `global_promo_events`
- `live_flash_sales`
- `social_publication_jobs`
- `video_generation_jobs`

## Causes possibles

1. **Les migrations SQLx standard n'ont pas été exécutées** : Ces tables sont créées par les migrations SQLx standard (`0000_create_all_tables.sql` et autres migrations)
2. **ENABLE_AUTO_MIGRATIONS n'est pas activé** : Les migrations automatiques ne s'exécutent pas au démarrage
3. **Les migrations automatiques ont échoué silencieusement** : Erreur lors de l'exécution des migrations automatiques

## Solution immédiate

### Option 1 : Exécuter les migrations depuis ECS (Recommandé)

1. **Se connecter à une tâche ECS en cours d'exécution** :
   ```bash
   aws ecs execute-command \
     --cluster yukpomnang-cluster \
     --task <TASK_ARN> \
     --container backend \
     --command /bin/bash \
     --interactive \
     --region us-east-1
   ```

2. **Dans le shell ECS, exécuter** :
   ```bash
   # Récupérer DATABASE_URL depuis l'environnement (déjà disponible dans ECS)
   cd /app/backend
   
   # Vérifier l'état des migrations
   sqlx migrate info
   
   # Exécuter toutes les migrations SQLx standard
   sqlx migrate run
   ```

3. **Vérifier que les tables ont été créées** :
   ```bash
   # Utiliser le script de vérification
   bash scripts/check-migrations-status-ecs.sh
   ```

### Option 2 : Exécuter les migrations localement (si vous avez accès réseau à RDS)

1. **Récupérer DATABASE_URL depuis SSM** :
   ```powershell
   $databaseUrl = aws ssm get-parameter `
     --name "/yukpomnang/production/DATABASE_URL" `
     --region us-east-1 `
     --with-decryption `
     --query 'Parameter.Value' `
     --output text
   ```

2. **Exporter DATABASE_URL** :
   ```powershell
   $env:DATABASE_URL = $databaseUrl
   ```

3. **Installer sqlx-cli si nécessaire** :
   ```powershell
   cargo install sqlx-cli --version 0.8.6 --locked --no-default-features --features postgres
   ```

4. **Exécuter les migrations** :
   ```powershell
   cd backend
   sqlx migrate info
   sqlx migrate run
   ```

### Option 3 : Utiliser le script Python (si vous avez accès réseau à RDS)

```powershell
# Exécuter le script Python pour créer les tables manquantes
.\scripts\run-fix-missing-tables-local.ps1
```

## Vérification de ENABLE_AUTO_MIGRATIONS

1. **Vérifier dans Secrets Manager** :
   ```powershell
   .\scripts\check-enable-auto-migrations.ps1
   ```

2. **Vérifier dans les logs CloudWatch** :
   - Chercher : `🔍 ENABLE_AUTO_MIGRATIONS: raw='...', parsed=...`
   - Si `parsed=false`, les migrations automatiques ne s'exécutent pas

3. **Activer si nécessaire** :
   - Utiliser le script PowerShell : `.\scripts\check-enable-auto-migrations.ps1`
   - Ou mettre à jour manuellement dans AWS Secrets Manager : `yukpomnang/backend/secrets` → `ENABLE_AUTO_MIGRATIONS` = `"true"`

## Après avoir créé les tables

1. **Redémarrer l'application ECS** pour exécuter les migrations automatiques restantes :
   ```bash
   aws ecs update-service \
     --cluster yukpomnang-cluster \
     --service yukpomnang-backend-service \
     --force-new-deployment \
     --region us-east-1
   ```

2. **Vérifier les logs CloudWatch** pour confirmer que les migrations automatiques s'exécutent :
   - Chercher : `🔄 Exécution des migrations automatiques (ENABLE_AUTO_MIGRATIONS=true)...`
   - Chercher : `✅ Migration auto: ...`

## Ordre d'exécution des migrations

1. **Migrations SQLx standard** (`sqlx migrate run`) :
   - Créent les tables de base : `deliveries`, `global_promo_events`, `live_flash_sales`, `social_publication_jobs`, etc.

2. **Migrations automatiques** (`run_auto_migrations`) :
   - Créent les tables supplémentaires : `product_creation_queue`, `delivery_proximity_suggestions`, `video_generation_jobs`, etc.
   - S'exécutent uniquement si `ENABLE_AUTO_MIGRATIONS=true`

## Vérification finale

Exécuter le script de vérification pour confirmer que toutes les tables existent :
```bash
bash scripts/check-migrations-status-ecs.sh
```

Ou vérifier manuellement dans PostgreSQL :
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'product_creation_queue',
    'deliveries',
    'delivery_matching_queue',
    'delivery_proximity_suggestions',
    'product_orders',
    'global_promo_events',
    'live_flash_sales',
    'social_publication_jobs',
    'video_generation_jobs'
)
ORDER BY table_name;
```

