# 🚀 Application Migration et Tests

## 📋 INSTRUCTIONS

### Option 1 : Via psql (RECOMMANDÉ)

```bash
# Se connecter à la base de données
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Exécuter le script complet
\i backend/tests/apply_migration_and_test.sql
```

### Option 2 : Exécution étape par étape

```bash
# 1. Appliquer la migration
psql "postgresql://..." -f backend/migrations/20260103_create_products_table.sql

# 2. Exécuter les tests
psql "postgresql://..." -f backend/tests/phase1_quick_tests.sql
```

## ✅ VÉRIFICATIONS ATTENDUES

### 1. Tables existent

- ✅ `products` (UUID) - pour tickets de bus
- ✅ `service_products` (SERIAL) - pour produits de services

### 2. Tests SQL

- ✅ TEST 1 : 0 différences (ou différences attendues après suppression JSONB)
- ✅ TEST 2 : 0 product_id invalides
- ✅ TEST 3 : Statistiques cohérentes
- ✅ TEST 4 : Services récents avec JSONB NULL

## 📊 RÉSULTATS ATTENDUS

### Structure des tables

**products (UUID)** :
- `id UUID PRIMARY KEY`
- `service_id INTEGER`
- `name TEXT`
- `type TEXT`
- etc.

**service_products (SERIAL)** :
- `id SERIAL PRIMARY KEY`
- `service_id INTEGER`
- `product_index INTEGER`
- `product_data JSONB`
- `product_name TEXT` (généré)
- `product_type TEXT` (généré)
- `product_price NUMERIC` (généré)
- etc.

### Index créés

Pour `service_products` :
- `idx_service_products_service_id`
- `idx_service_products_active`
- `idx_service_products_type`
- `idx_service_products_name_gin`
- `idx_service_products_data_gin`
- `idx_service_products_service_index`
- `idx_service_products_created_at`

