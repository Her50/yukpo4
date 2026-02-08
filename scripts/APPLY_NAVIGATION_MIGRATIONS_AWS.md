# 🚀 Guide: Appliquer les Migrations de Navigation Intelligente sur AWS PostgreSQL

## 📋 Prérequis

1. **Accès à AWS PostgreSQL** (RDS ou autre)
2. **DATABASE_URL** de votre base de données AWS
3. **psql** installé (client PostgreSQL) OU accès via AWS Console

## 🔧 Méthode 1: Script SQL Direct (Recommandé)

### Étape 1: Se connecter à la base de données

```bash
# Avec psql
psql "postgresql://user:password@host:5432/database?sslmode=require"

# Ou avec variables d'environnement
export PGHOST=your-host
export PGPORT=5432
export PGDATABASE=your-database
export PGUSER=your-user
export PGPASSWORD=your-password
psql
```

### Étape 2: Exécuter le script SQL

```sql
-- Copier-coller le contenu de scripts/apply_navigation_migrations_aws.sql
-- Ou exécuter directement:
\i scripts/apply_navigation_migrations_aws.sql
```

## 🔧 Méthode 2: Via AWS RDS Query Editor (Console Web)

1. Aller sur **AWS RDS Console**
2. Sélectionner votre instance PostgreSQL
3. Cliquer sur **Query Editor** (si disponible)
4. Copier-coller le contenu de `scripts/apply_navigation_migrations_aws.sql`
5. Exécuter

## 🔧 Méthode 3: Via ECS Task (si base dans VPC privé)

Si votre base de données est dans un VPC privé et non accessible depuis votre machine locale:

```powershell
# Utiliser le script existant pour exécuter via ECS
.\scripts\run-migrations-from-ecs.ps1
```

## ✅ Vérification Post-Migration

### Vérifier que les tables existent:

```sql
-- Vérifier navigation_trips
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'navigation_trips'
ORDER BY column_name;

-- Vérifier navigation_saved_destinations
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'navigation_saved_destinations'
ORDER BY column_name;
```

### Vérifier que les index existent:

```sql
-- Index navigation_trips
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'navigation_trips'
ORDER BY indexname;

-- Index navigation_saved_destinations
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'navigation_saved_destinations'
ORDER BY indexname;
```

## 📊 Migrations Appliquées

1. ✅ **navigation_trips** - Table pour enregistrer les trajets de navigation
   - Colonnes: id, user_id, origin_lat, origin_lng, destination_lat, destination_lng, route_id, distance_meters, duration_seconds, waypoints, created_at
   - Index: user_id, created_at, destination, user_created (composite)

2. ✅ **navigation_saved_destinations** - Table pour destinations favorites
   - Colonnes: id, user_id, label, custom_label, address, latitude, longitude, place_id, is_default, created_at, updated_at
   - Index: user_id, label, default

## ⚠️ Notes Importantes

- Toutes les migrations utilisent `IF NOT EXISTS`, donc elles sont **idempotentes**
- Les migrations peuvent être exécutées plusieurs fois sans erreur
- Si une table existe déjà, elle ne sera pas modifiée
- Les index sont créés uniquement s'ils n'existent pas déjà

## 🐛 Dépannage

### Erreur: "relation users does not exist"

Assurez-vous que la table `users` existe avant d'exécuter ces migrations.

### Erreur: "permission denied"

Assurez-vous que l'utilisateur PostgreSQL a les permissions `CREATE TABLE`, `CREATE INDEX` et `ALTER TABLE`.

## 📝 Fichiers

- `scripts/apply_navigation_migrations_aws.sql` - Script SQL direct (ce fichier)
- `backend/migrations/20260208_create_navigation_trips_table.sql` - Migration originale
- `backend/migrations/20260208_create_navigation_saved_destinations.sql` - Migration originale
- `backend/migrations/0000_create_all_tables.sql` - Migration principale (inclut ces tables)



