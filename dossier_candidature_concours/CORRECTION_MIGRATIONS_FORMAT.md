# ✅ Correction du format des migrations

## 🔍 Problème identifié

Les migrations suivantes n'étaient pas appliquées car elles avaient le même numéro de version (20251127) que d'autres migrations, sans numéro séquentiel pour garantir l'ordre d'exécution :

1. `20251127_fix_geo_hierarchy_unique_constraint.sql`
2. `20251127_optimize_services_queries_indexes.sql`

## ✅ Solution appliquée

### Renommage avec numéros séquentiels

Les migrations ont été renommées avec des numéros séquentiels uniques :

1. **Avant** : `20251127_fix_geo_hierarchy_unique_constraint.sql`
   **Après** : `20251127_120003_fix_geo_hierarchy_unique_constraint.sql`

2. **Avant** : `20251127_optimize_services_queries_indexes.sql`
   **Après** : `20251127_120004_optimize_services_queries_indexes.sql`

### Pourquoi ces numéros ?

- La dernière migration avec numéro séquentiel était `20251127_120002_optimize_slow_queries.sql`
- Les nouvelles migrations utilisent `120003` et `120004` pour être appliquées après

## 📋 Format SQLx

SQLx extrait le numéro de version depuis le début du nom de fichier jusqu'au premier underscore.

### Format recommandé

```
YYYYMMDD_NNNNNN_description.sql
```

Où :
- `YYYYMMDD` = Date (20251127)
- `NNNNNN` = Numéro séquentiel à 6 chiffres (120003, 120004, etc.)
- `description` = Description claire en snake_case

### Exemples de migrations existantes

- ✅ `20251127_120000_create_get_product_reactions_count.sql` → Version: 20251127, Ordre: 120000
- ✅ `20251127_120001_fix_search_services_gps_final.sql` → Version: 20251127, Ordre: 120001
- ✅ `20251127_120002_optimize_slow_queries.sql` → Version: 20251127, Ordre: 120002
- ✅ `20251127_120003_fix_geo_hierarchy_unique_constraint.sql` → Version: 20251127, Ordre: 120003 (NOUVEAU)
- ✅ `20251127_120004_optimize_services_queries_indexes.sql` → Version: 20251127, Ordre: 120004 (NOUVEAU)

## 🚀 Application

Les migrations seront automatiquement appliquées au prochain démarrage du backend via :

```rust
sqlx::migrate!("./migrations").run(&pg_pool).await
```

Dans `backend/src/main.rs` (ligne 111).

## ✅ Vérification

Pour vérifier que les migrations ont été appliquées :

```sql
SELECT version, description, installed_on, success 
FROM _sqlx_migrations 
WHERE description LIKE '%geo_hierarchy%' 
   OR description LIKE '%optimize_services%'
ORDER BY installed_on DESC;
```

## 📝 Notes importantes

1. **Ordre d'exécution** : SQLx trie les migrations par version numérique croissante, puis par ordre alphabétique si même version
2. **Numéros séquentiels** : Utiliser des numéros séquentiels garantit l'ordre d'exécution même si plusieurs migrations ont la même date
3. **Idempotence** : Les migrations utilisent `IF NOT EXISTS` pour être idempotentes (peuvent être exécutées plusieurs fois sans erreur)

