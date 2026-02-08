# 🚀 Guide: Appliquer les Migrations de Configuration de Livraison sur AWS PostgreSQL

## 📋 Prérequis

1. **Accès à AWS PostgreSQL** (RDS ou autre)
2. **DATABASE_URL** de votre base de données AWS
3. **psql** installé (client PostgreSQL) OU accès via AWS Console

## 🔧 Méthode 1: Script PowerShell (Recommandé)

### Étape 1: Obtenir DATABASE_URL

La DATABASE_URL AWS peut être trouvée dans:
- **AWS RDS Console** → Votre instance → Configuration → Endpoint
- **AWS SSM Parameter Store** (si configuré)
- **Variables d'environnement ECS** (si déployé)

Format: `postgresql://user:password@host:port/database?sslmode=require`

### Étape 2: Exécuter le script

```powershell
# Option A: Avec DATABASE_URL en paramètre
.\scripts\apply_delivery_config_migrations_aws.ps1 -DatabaseUrl "postgresql://user:pass@host:5432/db"

# Option B: Avec DATABASE_URL en variable d'environnement
$env:DATABASE_URL = "postgresql://user:pass@host:5432/db"
.\scripts\apply_delivery_config_migrations_aws.ps1
```

## 🔧 Méthode 2: Script SQL Direct

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
-- Copier-coller le contenu de scripts/apply_delivery_config_migrations_aws.sql
-- Ou exécuter directement:
\i scripts/apply_delivery_config_migrations_aws.sql
```

## 🔧 Méthode 3: Via AWS RDS Query Editor (Console Web)

1. Aller sur **AWS RDS Console**
2. Sélectionner votre instance PostgreSQL
3. Cliquer sur **Query Editor** (si disponible)
4. Copier-coller le contenu de `scripts/apply_delivery_config_migrations_aws.sql`
5. Exécuter

## 🔧 Méthode 4: Via ECS Task (si base dans VPC privé)

Si votre base de données est dans un VPC privé et non accessible depuis votre machine locale:

```powershell
# Utiliser le script existant pour exécuter via ECS
.\scripts\run-migrations-from-ecs.ps1
```

## ✅ Vérification Post-Migration

### Vérifier que les colonnes existent:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name IN (
    'preparation_time_minutes', 
    'storage_location_id',
    'max_preparation_time_minutes',
    'availability_days',
    'is_immediately_available'
)
ORDER BY column_name;
```

### Vérifier que les index existent:

```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'product_delivery_config'
AND indexname IN (
    'idx_product_delivery_config_availability_days',
    'idx_product_delivery_config_storage_location'
);
```

## 📊 Migrations Appliquées

1. ✅ **preparation_time_minutes** - Temps de préparation en minutes (Optionnel, peut être NULL)
2. ✅ **max_preparation_time_minutes** - Temps maximum de préparation (Défaut: 60)
3. ✅ **availability_days** - Jours de disponibilité (Array d'entiers, Défaut: [0,1,2,3,4,5,6])
4. ✅ **is_immediately_available** - Disponibilité immédiate (Boolean, Défaut: FALSE)
5. ✅ **storage_location_id** - Référence au lieu de stockage (Optionnel, FK vers merchant_storage_locations)

## ⚠️ Notes Importantes

- Toutes les migrations utilisent `IF NOT EXISTS`, donc elles sont **idempotentes**
- Les migrations peuvent être exécutées plusieurs fois sans erreur
- Si une colonne existe déjà, elle ne sera pas modifiée
- Les index sont créés uniquement s'ils n'existent pas déjà

## 🐛 Dépannage

### Erreur: "relation merchant_storage_locations does not exist"

Si la table `merchant_storage_locations` n'existe pas, la migration de `storage_location_id` échouera. Dans ce cas:

1. Créer d'abord la table `merchant_storage_locations`, OU
2. Modifier temporairement la migration pour ne pas inclure la contrainte FK:

```sql
-- Version sans FK (temporaire)
ALTER TABLE product_delivery_config
ADD COLUMN IF NOT EXISTS storage_location_id INTEGER;
```

### Erreur: "permission denied"

Assurez-vous que l'utilisateur PostgreSQL a les permissions `ALTER TABLE` et `CREATE INDEX`.

## 📝 Fichiers

- `scripts/apply_delivery_config_migrations_aws.ps1` - Script PowerShell automatisé
- `scripts/apply_delivery_config_migrations_aws.sql` - Script SQL direct
- `backend/migrations/20250120_001_add_order_preparation_system.sql` - Migration originale
- `backend/migrations/20260130_add_storage_location_id_to_product_delivery_config.sql` - Migration originale



