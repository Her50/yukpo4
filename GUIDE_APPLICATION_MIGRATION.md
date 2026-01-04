# 📋 GUIDE : Application Migration 20260103_create_products_table

## ⚠️ PROBLÈME DÉTECTÉ

La migration `20260103_create_products_table.sql` ne peut pas être appliquée automatiquement via `sqlx migrate run` car :
- Il y a un conflit avec la migration 0 (checksum différent)
- Il existe déjà une table `products` avec UUID (pour tickets de bus)

## ✅ SOLUTION : Application Manuelle

### Option 1 : Application Directe via psql (RECOMMANDÉ)

```bash
# Se connecter à la base de données
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Exécuter la migration
\i backend/migrations/20260103_create_products_table.sql
```

### Option 2 : Application via SQLx (après résolution du conflit)

Si vous voulez utiliser `sqlx migrate run`, vous devez d'abord résoudre le conflit de migration 0 :

```bash
# Option A : Supprimer la migration 0 de _sqlx_migrations (si elle n'est plus nécessaire)
psql "postgresql://..." -c "DELETE FROM _sqlx_migrations WHERE version = 0;"

# Option B : Corriger le checksum de la migration 0
# (nécessite de vérifier quelle version est correcte)
```

### Option 3 : Application Sélective

Exécuter uniquement la partie de la migration qui crée la table `products` :

```sql
-- Vérifier si la table products existe avec UUID
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'id';

-- Si UUID, renommer en bus_products
ALTER TABLE products RENAME TO bus_products;

-- Puis exécuter le reste de la migration 20260103_create_products_table.sql
```

## 📊 VÉRIFICATION POST-MIGRATION

Après application, vérifier que la table existe avec la bonne structure :

```sql
-- Vérifier la structure de la table products
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- Vérifier les index
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'products';

-- Vérifier que la table bus_products existe (si ancienne table renommée)
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'bus_products'
) as bus_products_exists;
```

**Résultats attendus** :
- ✅ Table `products` avec `id SERIAL` (pas UUID)
- ✅ Colonnes : `id`, `service_id`, `product_index`, `product_data`, `product_name`, `product_type`, `product_price`, `is_active`, `created_at`, `updated_at`, `auto_deactivate_at`
- ✅ Index créés : `idx_products_service_id`, `idx_products_active`, `idx_products_type`, etc.
- ✅ Trigger `trg_products_updated_at` créé
- ✅ Si ancienne table existait : `bus_products` existe

## 🔧 ADAPTATION DU CODE (si nécessaire)

Si l'ancienne table `products` (UUID) a été renommée en `bus_products`, il faut mettre à jour le code qui l'utilise :

**Fichiers à vérifier** :
- `backend/src/controllers/bus_ticket_controller.rs`
- `backend/src/routes/bus_reservations.rs`
- Tous les fichiers qui utilisent `INSERT INTO products` avec UUID

**Changement nécessaire** :
```rust
// AVANT
sqlx::query("INSERT INTO products (id, service_id, name, type, ...) VALUES ($1, $2, ...)")
    .bind(uuid::Uuid::new_v4())  // UUID

// APRÈS (si table renommée)
sqlx::query("INSERT INTO bus_products (id, service_id, name, type, ...) VALUES ($1, $2, ...)")
    .bind(uuid::Uuid::new_v4())  // UUID
```

## 📝 NOTES IMPORTANTES

1. **Sauvegarde** : Faire une sauvegarde de la base de données avant d'appliquer la migration
2. **Tests** : Tester la migration sur un environnement de développement d'abord
3. **Rollback** : Si problème, la migration peut être annulée en supprimant la table `products` et en renommant `bus_products` en `products`

## ✅ PROCHAINES ÉTAPES

Après application réussie de la migration :
1. Vérifier que la table `products` existe avec la bonne structure
2. Mettre à jour le code si `bus_products` a été créé
3. Exécuter les tests SQL (`backend/tests/phase1_integrity_tests.sql`)
4. Tester la création et l'ajout de produits

