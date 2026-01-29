# 🔍 Analyse : Tables Créées vs Tables Manquantes

## 📊 Constat

### Tables qui EXISTENT (créées au début de la migration 0)
- ✅ `users` (ligne 37)
- ✅ `services` (ligne 110)
- ✅ `media` (ligne 128)
- ✅ Autres tables de base créées avant la ligne 1800

### Tables qui MANQUENT (créées plus tard dans la migration 0)
- ❌ `live_flash_sales` (ligne 1800) → **Dépend de** : `live_sessions` (ligne 1738), `services`
- ❌ `global_promo_events` (ligne 1863) → **Dépend de** : `users`
- ❌ `social_publication_jobs` (ligne 1977) → **Aucune dépendance**
- ❌ `video_generation_jobs` (ligne 2053) → **Aucune dépendance**
- ❌ `deliveries` (ligne 2415) → **Dépend de** : `users`, `couriers` (ligne 2370), `delivery_parcels` (ligne 2403)
- ❌ `delivery_matching_queue` (ligne 2708) → **Dépend de** : `deliveries`, `delivery_zones` (ligne 2655)
- ❌ `product_creation_queue` (ligne 5354) → **Dépend de** : `services`, `users`
- ❌ `product_orders` (créée dans migration séparée `20250120_001_add_order_preparation_system.sql`) → **Dépend de** : `services`, `users`
- ❌ `delivery_proximity_suggestions` (créée dans une migration de delivery) → **Dépend de** : `deliveries`

### Tables de Dépendance Intermédiaires (à vérifier)
- `live_sessions` (ligne 1738) → **Dépend de** : `users`, `services`
- `couriers` (ligne 2370) → **Dépend de** : `users` (via `courier_applications`)
- `delivery_parcels` (ligne 2403) → **Dépend de** : `parcel_types` (ligne 2335)
- `delivery_zones` (ligne 2655) → **Aucune dépendance**
- `parcel_types` (ligne 2335) → **Aucune dépendance**

## 🎯 Hypothèses

### Hypothèse 1 : Migration 0 Arrêtée Partiellement (PLUS PROBABLE)

**Symptômes** :
- Tables du début créées (users, services)
- Tables du milieu/fin non créées
- Migration marquée comme "réussie" dans `_sqlx_migrations`

**Causes possibles** :
1. **Erreur SQL silencieuse** : Une erreur dans la migration a arrêté l'exécution, mais SQLx a quand même marqué la migration comme réussie
2. **Timeout** : La migration est trop longue et a timeout avant la fin
3. **Transaction partielle** : La migration n'est pas dans une transaction, donc certaines tables sont créées et d'autres non

### Hypothèse 2 : Migration 0 Non Exécutée

**Symptômes** :
- Aucune entrée dans `_sqlx_migrations` pour la version 0
- Ou entrée avec `success = false`

**Causes possibles** :
1. Migration 0 n'a jamais été exécutée
2. Migration 0 a échoué et n'a pas été réessayée

### Hypothèse 3 : Migration 0 Exécutée Mais Tables Supprimées

**Symptômes** :
- Entrée dans `_sqlx_migrations` avec `success = true`
- Tables n'existent plus

**Causes possibles** :
1. Tables supprimées manuellement
2. Migration de rollback exécutée
3. Base de données réinitialisée partiellement

## 🔍 Vérifications à Effectuer

### 1. Vérifier l'État de la Migration 0

```sql
SELECT version, description, success, installed_on, 
       encode(checksum, 'hex') as checksum_hex
FROM _sqlx_migrations 
WHERE version = 0;
```

**Interprétation** :
- Si `success = true` : Migration marquée comme réussie, mais tables manquantes = problème d'exécution partielle
- Si `success = false` : Migration a échoué
- Si aucune ligne : Migration jamais exécutée

### 2. Vérifier l'Ordre des Migrations Appliquées

```sql
SELECT version, description, success, installed_on
FROM _sqlx_migrations 
ORDER BY version;
```

**Interprétation** :
- Si version 0 existe et `success = true`, mais tables manquantes : Migration partielle
- Si version 0 n'existe pas : Migration jamais exécutée
- Si version 0 existe avec `success = false` : Migration a échoué

### 3. Vérifier les Dépendances

Les tables manquantes ont des dépendances :
- `delivery_matching_queue` → `REFERENCES deliveries(id)` (ligne 2710)
- `delivery_matching_queue` → `REFERENCES delivery_zones(id)` (ligne 2711)
- `live_flash_sales` → `REFERENCES live_sessions(id)` (ligne 1802)
- `live_flash_sales` → `REFERENCES services(id)` (ligne 1803)

**Si `deliveries` n'existe pas**, alors `delivery_matching_queue` ne peut pas être créée à cause de la foreign key.

**Si `live_sessions` n'existe pas**, alors `live_flash_sales` ne peut pas être créée.

### 4. Vérifier l'Existence des Tables de Dépendance

```sql
-- Vérifier les tables de dépendance
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'deliveries',
  'delivery_zones',
  'live_sessions',
  'couriers'
)
ORDER BY table_name;
```

## 🔧 Solutions selon le Diagnostic

### Si Migration 0 Partiellement Exécutée

**Solution 1 : Réexécuter la Migration 0 Complète**

```sql
-- Supprimer l'entrée de migration 0
DELETE FROM _sqlx_migrations WHERE version = 0;

-- Réexécuter la migration
-- (via sqlx migrate run ou manuellement)
```

**⚠️ ATTENTION** : Cela peut créer des erreurs "table already exists" pour les tables déjà créées.

**Solution 2 : Créer Manuellement les Tables Manquantes**

Exécuter uniquement les parties de la migration 0 qui créent les tables manquantes.

**Solution 3 : Utiliser les Migrations Séparées**

Certaines tables ont des migrations dédiées :
- `product_creation_queue` → `20260102_create_product_creation_queue.sql`
- `delivery_matching_queue` → `20251115001_create_delivery_matching_tables.sql`
- `global_promo_events` → `20251115002_create_global_promo_platform.sql`
- `live_flash_sales` → `20251111001_002_create_live_flash_sales.sql`

Ces migrations utilisent `CREATE TABLE IF NOT EXISTS`, donc elles peuvent être exécutées même si la migration 0 a partiellement échoué.

### Si Migration 0 Non Exécutée

**Solution** : Exécuter toutes les migrations depuis le début

```bash
sqlx migrate run
```

### Si Tables Supprimées

**Solution** : Réexécuter les migrations concernées

## 📋 Plan d'Action Recommandé

1. **Vérifier l'état de la migration 0** dans `_sqlx_migrations`
2. **Vérifier les tables de dépendance** (deliveries, live_sessions, etc.)
3. **Exécuter les migrations séparées** pour les tables manquantes :
   - `20260102_create_product_creation_queue.sql`
   - `20251115001_create_delivery_matching_tables.sql`
   - `20251115002_create_global_promo_platform.sql`
   - `20251111001_002_create_live_flash_sales.sql`
   - `20250120_001_add_order_preparation_system.sql` (product_orders)
4. **Vérifier que toutes les tables existent** après
5. **Si nécessaire, corriger la migration 0** pour éviter le problème à l'avenir

## 🔍 Points d'Attention

### Dépendances en Cascade

Si `deliveries` n'existe pas, plusieurs tables ne peuvent pas être créées :
- `delivery_matching_queue` (dépend de deliveries)
- `delivery_status_events` (dépend de deliveries)
- `delivery_tracking_points` (dépend de deliveries)
- Etc.

### Ordre d'Exécution

Les migrations SQLx sont exécutées dans l'ordre chronologique. Si la migration 0 échoue partiellement, les migrations suivantes peuvent échouer à cause de dépendances manquantes.

### Transaction vs Non-Transaction

Si la migration 0 n'est pas dans une transaction, certaines tables peuvent être créées et d'autres non en cas d'erreur.

