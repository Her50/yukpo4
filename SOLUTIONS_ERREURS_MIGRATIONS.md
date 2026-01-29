# Solutions pour les Erreurs de Migrations PostgreSQL

## 🔴 Problème 1 : CREATE TRIGGER dans IF NOT EXISTS (Syntaxe Invalide)

### Cause
La fonction `normalize_sql_command()` dans `auto_migrate.rs` (lignes 11844-11880) wrapper automatiquement les `CREATE TRIGGER` dans des blocs `DO $$` avec une syntaxe invalide :

```rust
// ❌ CODE PROBLÉMATIQUE (ligne 11864-11877)
return format!(
    r#"DO $$
    BEGIN
        IF NOT EXISTS (...) THEN
            CREATE TRIGGER ...  // ❌ INVALIDE en PostgreSQL
        END IF;
    END $$;
```

### Solution
Modifier `normalize_sql_command()` pour utiliser `EXECUTE` :

```rust
// ✅ CODE CORRIGÉ
return format!(
    r#"DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = '{}'
        ) THEN
            EXECUTE 'CREATE TRIGGER {}';
        END IF;
    END $$;
    "#,
    trigger_name,
    trigger_decl.trim_end_matches(';')
);
```

**Fichier à modifier :** `backend/src/migrations/auto_migrate.rs` lignes 11864-11877

---

## 🔴 Problème 2 : Table `products` Manquante

### Erreur
```
relation "products" does not exist
```

### Références
- `delivery_product_suggestions.suggested_product_id REFERENCES products(id)`
- Ligne 4842 de `0000_create_all_tables.sql`

### Solution
**Option A :** Retirer la contrainte de clé étrangère (si `products` n'est pas nécessaire) :
```sql
suggested_product_id INTEGER,  -- Sans REFERENCES
```

**Option B :** Créer la table `products` si elle doit exister

**Fichier à modifier :** `backend/migrations/0000_create_all_tables.sql` ligne 4842

---

## 🔴 Problème 3 : Table `reservations` Manquante

### Erreur
```
relation "reservations" does not exist
```

### Références
- `covoiturage_insurance.reservation_id REFERENCES reservations(id)`
- `reservation_qr_codes.reservation_id REFERENCES reservations(id)`
- Migration `20250129_add_insurance_qr_covoiturage.sql`

### Solution
**Option A :** Utiliser `covoiturage_reservations` ou `bus_reservations` si c'est ce qui est attendu

**Option B :** Créer la table `reservations` générique

**Fichier à modifier :** `backend/migrations/20250129_add_insurance_qr_covoiturage.sql`

---

## 🔴 Problème 4 : Colonne `gps` Manquante dans `services`

### Erreur
```
column "gps" does not exist
```

### Références
- Index `idx_services_gps_search`
- Vue `services_search_cache` (ligne avec `s.gps`)
- Vue `active_products_cache` (ligne avec `s.gps`)
- Fonction `hybrid_image_search` (références `s.gps`)

### Solution
**Option A :** Ajouter la colonne `gps` à `services` :
```sql
ALTER TABLE services ADD COLUMN IF NOT EXISTS gps VARCHAR(255);
```

**Option B :** Utiliser `s.data->>'gps'` dans les vues et fonctions si GPS est dans JSONB

**Fichiers à modifier :**
- `backend/migrations/0000_create_all_tables.sql` (ajouter colonne à CREATE TABLE services)
- Ou corriger les références dans les vues/fonctions

---

## 🟠 Problème 5 : Syntaxe INDEX dans CREATE TABLE (MySQL)

### Erreur
```
type "idx_loyalty_user_id" does not exist
```

### Tables Affectées
- `loyalty_transactions`
- `chat_support_sessions`
- `chat_support_messages`

### Solution
Séparer les index des CREATE TABLE :

```sql
-- ❌ AVANT (syntaxe MySQL)
CREATE TABLE loyalty_transactions (
    ...
    INDEX idx_loyalty_user_id (user_id),
    INDEX idx_loyalty_timestamp (timestamp)
);

-- ✅ APRÈS (syntaxe PostgreSQL)
CREATE TABLE loyalty_transactions (
    ...
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user_id ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_timestamp ON loyalty_transactions(timestamp);
```

**Fichiers à modifier :** Rechercher dans `0000_create_all_tables.sql` les CREATE TABLE avec INDEX

---

## 🟠 Problème 6 : "cannot insert multiple commands into a prepared statement"

### Cause
Certaines migrations contiennent plusieurs commandes SQL qui ne peuvent pas être exécutées ensemble via `sqlx::query()`.

### Migrations Affectées
- `20251230_optimize_audio_search_cache.sql` (création `run_audio_cache_cleanup()`)
- `20260114_fix_image_search_to_tsvector_error.sql`
- `20251230_optimize_search_performance_final.sql`

### Solution
La fonction `execute_multiple_sql_commands()` devrait gérer cela, mais elle semble échouer pour certaines migrations. Vérifier que :
1. Les blocs `DO $$` sont correctement parsés
2. Les fonctions avec `$$ LANGUAGE plpgsql;` sont correctement détectées comme fin de bloc

**Fichier à vérifier :** `backend/src/migrations/auto_migrate.rs` fonction `execute_multiple_sql_commands()`

---

## 🟡 Problème 7 : Fonction `hybrid_image_search` Dupliquée

### Solution
Utiliser `DROP FUNCTION IF EXISTS` avec la signature complète :

```sql
DROP FUNCTION IF EXISTS hybrid_image_search(
    TEXT[], TEXT, TEXT, TEXT, TEXT, FLOAT, FLOAT, INTEGER, TEXT
) CASCADE;
```

**Fichiers à modifier :** Migrations qui créent `hybrid_image_search`

---

## 🟡 Problème 8 : Index avec NOW() Non IMMUTABLE

### Erreur
```
functions in index predicate must be marked IMMUTABLE
```

### Solution
Retirer `NOW()` du prédicat d'index :

```sql
-- ❌ AVANT
CREATE INDEX ... WHERE ... AND next_attempt_at <= NOW();

-- ✅ APRÈS
CREATE INDEX ... WHERE ... AND next_attempt_at IS NOT NULL;
-- Ou utiliser une autre approche sans NOW()
```

**Fichier à modifier :** Migration qui crée `idx_delivery_matching_queue_next_attempt_pending`

---

## 🟡 Problème 9 : Vue - Changement de Type de Colonne

### Solution
DROP VIEW avant CREATE OR REPLACE :

```sql
DROP VIEW IF EXISTS product_comments_view;
CREATE OR REPLACE VIEW product_comments_view AS ...;
```

---

## 🟡 Problème 10 : Partitionnement sur Tables Non Partitionnées

### Solution
Vérifier si la table est partitionnée avant de créer des partitions :

```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'delivery_tracking_points'
        AND c.relkind = 'p'  -- 'p' = partitioned table
    ) THEN
        -- Créer les partitions
    END IF;
END $$;
```

---

## 📋 Plan d'Action Prioritaire

### Phase 1 : Corrections Critiques (Bloquent les migrations)
1. ✅ Corriger `normalize_sql_command()` pour CREATE TRIGGER (utiliser EXECUTE)
2. ✅ Ajouter colonne `gps` à `services` ou corriger les références
3. ✅ Retirer/corriger références à `products` et `reservations`

### Phase 2 : Corrections Importantes
4. ✅ Corriger syntaxe INDEX dans CREATE TABLE
5. ✅ Améliorer parsing de `execute_multiple_sql_commands()` pour blocs DO $$
6. ✅ S'assurer que les tables sont commitées avant index

### Phase 3 : Améliorations
7. ✅ Corriger DROP FUNCTION pour `hybrid_image_search`
8. ✅ Retirer NOW() des prédicats d'index
9. ✅ DROP VIEW avant CREATE OR REPLACE
10. ✅ Vérifier partitionnement avant création de partitions

