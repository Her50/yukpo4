# 🧪 GUIDE : Exécution des Tests SQL

## 🚀 MÉTHODE RAPIDE (Recommandée)

### Étape 1 : Se connecter à la base de données

```bash
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
```

### Étape 2 : Appliquer la migration et exécuter les tests

```sql
-- Option A : Script complet (migration + tests)
\i backend/tests/apply_migration_and_test.sql

-- Option B : Migration seule
\i backend/migrations/20260103_create_products_table.sql

-- Option C : Tests seuls (après migration)
\i backend/tests/phase1_quick_tests.sql
```

## 📊 VÉRIFICATIONS MANUELLES

### 1. Vérifier que les deux tables existent

```sql
-- Vérifier products (UUID)
SELECT 
    'products (UUID)' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position
LIMIT 5;

-- Vérifier service_products (SERIAL)
SELECT 
    'service_products (SERIAL)' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'service_products'
ORDER BY ordinal_position;
```

**Résultats attendus** :
- ✅ `products` : `id UUID`, `name TEXT`, `type TEXT`, etc.
- ✅ `service_products` : `id SERIAL`, `product_index INTEGER`, `product_data JSONB`, etc.

### 2. Vérifier les index

```sql
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('products', 'service_products')
ORDER BY tablename, indexname;
```

**Résultats attendus** :
- ✅ `products` : `idx_products_service_id`, `idx_products_type`, etc.
- ✅ `service_products` : `idx_service_products_service_id`, `idx_service_products_active`, etc.

### 3. Vérifier les triggers

```sql
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('products', 'service_products');
```

**Résultats attendus** :
- ✅ `products` : `trg_products_updated_at`
- ✅ `service_products` : `trg_service_products_updated_at`

## 🧪 EXÉCUTION DES TESTS

### Test Rapide (4 tests essentiels)

```sql
\i backend/tests/phase1_quick_tests.sql
```

### Tests Complets (8 tests détaillés)

```sql
\i backend/tests/phase1_integrity_tests.sql
```

## 📋 INTERPRÉTATION DES RÉSULTATS

### TEST 1 : Intégrité produits

**Résultat attendu** :
- `services_avec_differences = 0` (ou différences attendues après suppression JSONB)
- `services_avec_produits_manquants = 0` (ou nombre de services non migrés)
- `services_avec_produits_en_trop = 0` (normal après suppression JSONB)

**Si des différences** :
- `produits_jsonb > produits_table` : Produits existants non migrés → Phase 2 nécessaire
- `produits_jsonb < produits_table` : Normal après suppression JSONB

### TEST 2 : product_id dans autocomplete_characteristics

**Résultat attendu** :
- `product_id_invalides = 0`

**Si > 0** :
- Vérifier que `save_autocomplete_combination` a été appelé
- Exécuter Phase 2 si nécessaire

### TEST 3 : Statistiques globales

**Résultats attendus** :
- Statistiques cohérentes entre JSONB et `service_products`
- Nombre de produits avec `autocomplete_characteristics` > 0

### TEST 4 : Services récents

**Résultat attendu** :
- Services récents avec `status_jsonb = '✅ NULL'` (après suppression JSONB)

## ✅ CHECKLIST

- [ ] Migration `20260103_create_products_table.sql` appliquée
- [ ] Table `products` (UUID) existe et fonctionne
- [ ] Table `service_products` (SERIAL) existe et fonctionne
- [ ] Index créés pour `service_products`
- [ ] Trigger créé pour `service_products`
- [ ] TEST 1 : 0 différences (ou attendues)
- [ ] TEST 2 : 0 product_id invalides
- [ ] TEST 3 : Statistiques cohérentes
- [ ] TEST 4 : Services récents avec JSONB NULL

## 🔍 DÉPANNAGE

### Erreur : "relation service_products does not exist"

**Solution** : Appliquer la migration
```sql
\i backend/migrations/20260103_create_products_table.sql
```

### Erreur : "relation products does not exist"

**Solution** : La table `products` (UUID) devrait exister via `20250124_create_products_table.sql`
```sql
-- Vérifier
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'products'
);
```

### Erreur : "duplicate key value violates unique constraint"

**Solution** : Vérifier les contraintes UNIQUE
```sql
-- Vérifier les contraintes
SELECT 
    conname,
    contype
FROM pg_constraint
WHERE conrelid = 'service_products'::regclass;
```

