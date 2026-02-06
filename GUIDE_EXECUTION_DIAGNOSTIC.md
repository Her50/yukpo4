# 🔍 Guide : Exécution du Diagnostic des Migrations

## 📋 Fichiers Créés

1. **Script SQL** : `backend/scripts/diagnose_migrations_aws.sql`
   - Requêtes SQL pour diagnostiquer l'état des migrations
   
2. **Script PowerShell** : `backend/scripts/run_diagnostic_aws.ps1`
   - Script pour exécuter le diagnostic depuis Windows
   - Récupère automatiquement DATABASE_URL depuis AWS Secrets Manager
   
3. **Binaire Rust** : `backend/src/bin/diagnose_migrations.rs`
   - Script Rust exécutable depuis ECS ou avec accès VPN
   - Affiche un rapport détaillé de l'état des migrations

## 🚀 Méthodes d'Exécution

### Option 1 : Depuis ECS (Recommandé)

La base de données RDS est dans un VPC privé, donc accessible uniquement depuis ECS.

**Exécuter une tâche ECS** :
```bash
# Depuis votre machine locale (avec AWS CLI configuré)
aws ecs run-task \
    --cluster yukpomnang-cluster \
    --task-definition yukpomnang-backend \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
    --overrides '{
        "containerOverrides": [{
            "name": "backend",
            "command": ["cargo", "run", "--bin", "diagnose_migrations"]
        }]
    }'
```

### Option 2 : Depuis un Bastion Host

Si vous avez un bastion host avec accès au VPC :

```bash
# Se connecter au bastion
ssh user@bastion-host

# Cloner le repo et exécuter
cd yukpomnang2/backend
cargo run --bin diagnose_migrations
```

### Option 3 : Depuis une Machine avec VPN

Si vous avez un VPN configuré pour accéder au VPC :

```bash
cd backend
cargo run --bin diagnose_migrations
```

### Option 4 : Via psql Directement (si accessible)

```bash
cd backend/scripts
psql $DATABASE_URL -f diagnose_migrations_aws.sql
```

## 📊 Ce que le Diagnostic Vérifie

1. **État de `_sqlx_migrations`**
   - Versions des migrations appliquées
   - Statut (succès/échec)
   - Checksums
   - Temps d'exécution

2. **Tables Critiques**
   - `users`, `services`, `media` (tables de base)
   - `deliveries`, `product_creation_queue`, `delivery_matching_queue`
   - `live_flash_sales`, `global_promo_events`
   - `product_orders`, `social_publication_jobs`, `video_generation_jobs`
   - `delivery_proximity_suggestions`

3. **Types ENUM**
   - `delivery_status`
   - `delivery_cancel_reason`
   - `delivery_courier_status`
   - `delivery_matching_status`

4. **Tables de Dépendance**
   - `live_sessions`
   - `parcel_types`, `couriers`, `delivery_parcels`
   - `delivery_zones`

## 🔧 Après le Diagnostic

Si des tables manquent, appliquez la migration consolidée :

```bash
# Depuis ECS
cargo run --bin apply_missing_tables_migration

# Ou via psql
psql $DATABASE_URL -f migrations/20260129_create_missing_tables_aws.sql
```

## 📝 Exemple de Sortie

```
🔍 Diagnostic des migrations AWS...
   Database: postgresql://yukpo_admin:****@yukpomnang-db...:5432/yukpomnang
✅ Connexion à la base de données établie

📊 1. État de la table _sqlx_migrations:
================================================================================
Version    Description                              Installed On        Success   Time (ms)    Checksum
--------------------------------------------------------------------------------
0          create all tables                        2026-01-29 15:00:00  ✅        45000        a1b2c3d4...

📊 2. État des tables critiques:
================================================================================
Table                                  Status
--------------------------------------------------------------------------------
users                                  ✅ Existe
services                               ✅ Existe
deliveries                             ❌ Manquante
product_creation_queue                 ❌ Manquante
...

📊 5. Résumé:
================================================================================
❌ 9 table(s) critique(s) manquante(s):
   - deliveries
   - product_creation_queue
   ...

💡 Solution: Appliquer la migration consolidée:
   cargo run --bin apply_missing_tables_migration
```





