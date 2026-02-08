# 📘 Guide des Migrations Automatiques - Base de Données PostgreSQL AWS

**Date de création**: 2026-02-08  
**Status**: ✅ **Actif et Automatisé**

## 🎯 Vue d'Ensemble

Ce document référence **le système de migrations automatiques** de l'application Yukpomnang. Toutes les migrations sont appliquées **automatiquement au démarrage du backend** via le processus Git → Docker → AWS ECS.

## 📁 Fichiers de Migration Principaux

### 1. Migrations Critiques Appliquées ✅

#### `backend/migrations/20260207_fix_all_missing_tables_and_functions.sql`
- **Status**: ✅ Appliquée automatiquement
- **Contenu**:
  - Table `user_saved_addresses` (avec index)
  - Fonction `calculate_vector_match_score_optimized`
  - Fonction `calculate_best_vector_match_score`
  - Fonction `product_combination_exists`
  - Index unique pour vue matérialisée `services_search_optimized_v2`
- **Idempotence**: ✅ Utilise `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE INDEX IF NOT EXISTS`

#### `backend/migrations/20260207_create_delivery_requests_and_courier_profiles.sql`
- **Status**: ✅ Appliquée automatiquement
- **Contenu**:
  - Vue `delivery_requests` (mappe `deliveries` vers `delivery_requests`)
  - Table `courier_profiles` (positions GPS coursiers)
  - 4 index pour `courier_profiles`
  - Trigger `update_courier_profiles_updated_at()`
- **Idempotence**: ✅ Utilise `DROP VIEW IF EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`

#### `backend/migrations/20260208_create_navigation_trips_table.sql`
- **Status**: ✅ Appliquée automatiquement
- **Contenu**:
  - Table `navigation_trips` (enregistre les trajets de navigation pour statistiques)
  - 4 index pour optimiser les requêtes de statistiques
  - Colonnes: id, user_id, origin_lat, origin_lng, destination_lat, destination_lng, route_id, distance_meters, duration_seconds, waypoints, created_at
- **Idempotence**: ✅ Utilise `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`

#### `backend/migrations/20260208_create_navigation_saved_destinations.sql`
- **Status**: ✅ Appliquée automatiquement
- **Contenu**:
  - Table `navigation_saved_destinations` (destinations favorites: domicile, bureau, etc.)
  - 3 index pour requêtes fréquentes
  - Colonnes: id, user_id, label, custom_label, address, latitude, longitude, place_id, is_default, created_at, updated_at
  - Contrainte unique: (user_id, label)
- **Idempotence**: ✅ Utilise `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`

### 2. Scripts d'Exécution

#### `backend/scripts/executer_migration_sql.ps1`
- **Description**: Script PowerShell pour exécuter une migration SQL via conteneur PostgreSQL sur ECS
- **Usage**: Utilisé pour appliquer manuellement des migrations en cas de besoin
- **Méthode**: Crée un conteneur temporaire PostgreSQL sur ECS Fargate, exécute le SQL, puis se termine
- **Gestion connexion AWS**: ✅ Récupère automatiquement `DATABASE_URL` depuis AWS SSM Parameter Store
- **Gestion réseau**: ✅ Configure automatiquement le VPC, subnets et security groups
- **Exemple d'utilisation**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File backend/scripts/executer_migration_sql.ps1 -ScriptPath "backend/migrations/20260208_create_navigation_trips_table.sql"
  ```

#### `backend/run_all_migrations.sql`
- **Description**: Script SQL qui exécute toutes les migrations individuelles en séquence
- **Usage**: À exécuter avec `psql` pour forcer l'application de toutes les migrations
- **Gestion connexion AWS**: Ajouter `?sslmode=require` à la DATABASE_URL pour AWS RDS
- **Exemple d'utilisation**:
  ```bash
  cd backend
  psql "postgresql://user:password@host:port/database?sslmode=require" -f run_all_migrations.sql
  ```

## 🔄 Processus Automatique de Migration

### Ordre d'Exécution au Démarrage

```
1. Connexion PostgreSQL
   ↓
2. sqlx::migrate!("./migrations") 
   → Exécute TOUS les fichiers .sql dans backend/migrations/
   → Dans l'ordre chronologique (par nom de fichier)
   → Utilise la table _sqlx_migrations pour suivre les migrations appliquées
   → Ignore les migrations déjà appliquées (idempotent)
   ↓
3. Vérification des tables critiques
   ↓
4. auto_migrate::run_auto_migrations() (si ENABLE_AUTO_MIGRATIONS=true)
   → Crée les tables complémentaires
   → Crée les fonctions supplémentaires
   → Crée les index manquants
```

### Code dans `backend/src/main.rs`

```rust
// Ligne ~738
log::info!("🔄 [MIGRATIONS SQLX] Application de toutes les migrations SQLx standard...");
match sqlx::migrate!("./migrations").run(&pg_pool).await {
    Ok(_) => {
        log::info!("✅ Migrations SQLx standard appliquées avec succès");
        // Vérifications post-migration...
    }
    Err(e) => {
        log::error!("❌ Erreur lors de l'application des migrations SQLx standard: {}", e);
        // Continue quand même le démarrage...
    }
}
```

## ✅ Garanties d'Idempotence

### Pourquoi les Builds Futurs ne Casseront Pas les Migrations

1. **`CREATE TABLE IF NOT EXISTS`**
   - Si la table existe déjà, la commande est ignorée
   - Pas d'erreur, pas de conflit

2. **`CREATE OR REPLACE FUNCTION`**
   - Remplace la fonction si elle existe
   - Crée la fonction si elle n'existe pas
   - Idempotent et sûr

3. **`CREATE INDEX IF NOT EXISTS`**
   - Crée l'index seulement s'il n'existe pas
   - Pas d'erreur si l'index existe déjà

4. **`DROP VIEW IF EXISTS`** puis `CREATE VIEW`
   - Supprime la vue si elle existe (pour mise à jour)
   - Crée la vue (toujours à jour)

5. **Table `_sqlx_migrations`**
   - SQLx suit toutes les migrations appliquées
   - Les migrations déjà appliquées sont ignorées automatiquement
   - Chaque migration a un checksum pour détecter les modifications

## 🚀 Intégration dans le Build Automatique

### Pipeline Git → Docker → AWS ECS

```
1. Push Git
   ↓
2. GitHub Actions / CI/CD
   ↓
3. Build Docker Image
   - Compile le backend Rust
   - Inclut tous les fichiers dans backend/migrations/
   ↓
4. Push vers ECR (Elastic Container Registry)
   ↓
5. Déploiement ECS
   - Nouvelle tâche démarre
   ↓
6. Au démarrage du conteneur:
   - main.rs s'exécute
   - sqlx::migrate!("./migrations") s'exécute automatiquement
   - Toutes les migrations sont appliquées
   ↓
7. Application prête ✅
```

### Variables d'Environnement

- `DATABASE_URL`: URL de connexion PostgreSQL (récupérée depuis AWS SSM Parameter Store)
- `ENABLE_AUTO_MIGRATIONS`: Active/désactive `auto_migrate::run_auto_migrations()` (défaut: `false`)

## 📋 Checklist pour Nouvelles Migrations

Lors de la création d'une nouvelle migration :

1. ✅ **Nom de fichier**: Format `YYYYMMDD_description.sql` (ex: `20260208_add_new_feature.sql`)
2. ✅ **Idempotence**: Utiliser `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP IF EXISTS`
3. ✅ **Tests**: Tester la migration sur une base de test avant déploiement
4. ✅ **Documentation**: Ajouter une description en commentaire SQL
5. ✅ **Vérification**: Ajouter un bloc `DO $$` pour vérifier la création (optionnel)

### Template de Migration

```sql
-- Migration: Description courte
-- Date: YYYY-MM-DD
-- Description: Description détaillée

-- Créer la table (idempotent)
CREATE TABLE IF NOT EXISTS ma_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- autres colonnes...
);

-- Créer les index (idempotent)
CREATE INDEX IF NOT EXISTS idx_ma_table_colonne ON ma_table(colonne);

-- Créer la fonction (idempotent)
CREATE OR REPLACE FUNCTION ma_fonction()
RETURNS TYPE AS $$
BEGIN
    -- code...
END;
$$ LANGUAGE plpgsql;

-- Vérification (optionnel)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ma_table') THEN
        RAISE NOTICE '✅ Table ma_table créée';
    END IF;
END $$;
```

## 🔍 Vérification des Migrations

### Scripts de Vérification Disponibles

1. **`backend/scripts/executer_rapport_verification.ps1`**
   - Génère un rapport JSON complet de l'état de la base
   - Vérifie tables, fonctions, index, vues matérialisées

2. **`backend/scripts/verifier_vue_delivery_requests.ps1`**
   - Vérifie spécifiquement la vue `delivery_requests` et la table `courier_profiles`

### Commandes Manuelles

```bash
# Vérifier les migrations appliquées
psql $DATABASE_URL -c "SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 10;"

# Vérifier une table spécifique
psql $DATABASE_URL -c "\d ma_table"

# Vérifier une fonction
psql $DATABASE_URL -c "\df ma_fonction"
```

## ⚠️ Résolution de Problèmes

### Migration Échoue au Démarrage

1. **Vérifier les logs ECS**:
   ```bash
   aws logs tail /ecs/yukpomnang-backend --region us-east-1 --since 10m
   ```

2. **Vérifier la table `_sqlx_migrations`**:
   - Si une migration a un mauvais checksum, la supprimer et réappliquer

3. **Appliquer manuellement**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/executer_migration_sql.ps1 -ScriptPath "backend/migrations/ma_migration.sql"
   ```

### Migration Déjà Appliquée mais Manquante

1. **Vérifier si l'objet existe**:
   ```sql
   SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ma_table');
   ```

2. **Si manquant, appliquer manuellement**:
   - Utiliser `executer_migration_sql.ps1`
   - Ou exécuter directement via `psql`

## 📚 Références

- **Fichier principal de référence**: `MIGRATIONS_RESTANTES_APPLIQUEES.md`
- **Code source migrations**: `backend/src/migrations/auto_migrate.rs`
- **Point d'entrée**: `backend/src/main.rs` (ligne ~738)
- **Dossier migrations**: `backend/migrations/`
- **Script d'exécution manuelle**: `backend/scripts/executer_migration_sql.ps1` (gère automatiquement la connexion AWS)
- **Script pour toutes les migrations**: `backend/run_all_migrations.sql` (à exécuter avec psql)

## 🎯 Résumé

✅ **Toutes les migrations sont automatiques** - Aucune intervention manuelle nécessaire  
✅ **Idempotentes** - Peuvent être exécutées plusieurs fois sans erreur  
✅ **Traçables** - Table `_sqlx_migrations` suit toutes les migrations  
✅ **Sûres** - Les builds futurs ne casseront pas les migrations existantes  
✅ **Intégrées** - Fait partie du processus Git → Docker → AWS ECS  

**Pour trouver rapidement ce fichier dans une session future**: Chercher "GUIDE_MIGRATIONS_AUTOMATIQUES" ou "migrations automatiques base de données"

