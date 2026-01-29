# Analyse des Erreurs de Migrations PostgreSQL - 2026-01-29

## 🔴 Problèmes Critiques Identifiés

### 1. **Erreurs de Syntaxe : CREATE TRIGGER dans IF NOT EXISTS**

**Erreur :**
```
syntax error at or near "END" at character 492
```

**Problème :** PostgreSQL ne permet pas `CREATE TRIGGER` dans un bloc `IF NOT EXISTS` directement. La syntaxe utilisée est invalide :
```sql
DO $$
BEGIN
    IF NOT EXISTS (...) THEN
        CREATE TRIGGER ...  -- ❌ INVALIDE
    END IF;
END $$;
```

**Tables affectées :**
- `experiences_anciens_etudiants`
- `conferences_lives_scolaires`
- `user_documents`
- `videos`
- `content_engagement`
- `message_reactions`

**Solution :** Utiliser `DO $$` avec `EXECUTE` :
```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_name') THEN
        EXECUTE 'CREATE TRIGGER trigger_name ...';
    END IF;
END $$;
```

---

### 2. **Tables Manquantes**

**Tables référencées mais inexistantes :**
- ❌ `products` - Référencée dans `delivery_product_suggestions`
- ❌ `reservations` - Référencée dans `covoiturage_insurance` et `reservation_qr_codes`

**Impact :** Les migrations échouent car les clés étrangères ne peuvent pas être créées.

**Solution :** 
- Créer la table `products` si nécessaire, ou
- Retirer la référence `REFERENCES products(id)` et utiliser `INTEGER` sans contrainte
- Vérifier si `reservations` doit être créée ou si c'est une autre table (ex: `bus_reservations`, `covoiturage_reservations`)

---

### 3. **Colonne `gps` Manquante dans `services`**

**Erreur :**
```
column "gps" does not exist at character 101
column s.gps does not exist at character 147
```

**Problème :** La colonne `gps` n'existe pas dans la table `services` mais est référencée dans :
- Index `idx_services_gps_search`
- Vue matérialisée `services_search_cache`
- Vue matérialisée `active_products_cache`
- Fonction `hybrid_image_search`

**Solution :** 
- Vérifier si `gps` doit être ajoutée à `services` (ALTER TABLE)
- Ou utiliser `s.data->>'gps'` si GPS est stocké dans JSONB

---

### 4. **Syntaxe INDEX dans CREATE TABLE (MySQL vs PostgreSQL)**

**Erreur :**
```
type "idx_loyalty_user_id" does not exist
type "idx_chat_user_id" does not exist
type "idx_chat_messages_session" does not exist
```

**Problème :** Syntaxe MySQL utilisée dans PostgreSQL :
```sql
CREATE TABLE ... (
    ...
    INDEX idx_name (column)  -- ❌ Syntaxe MySQL
);
```

**Solution :** Créer les index séparément :
```sql
CREATE TABLE ... (...);
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);
```

**Tables affectées :**
- `loyalty_transactions`
- `chat_support_sessions`
- `chat_support_messages`

---

### 5. **"cannot insert multiple commands into a prepared statement"**

**Erreur :**
```
cannot insert multiple commands into a prepared statement
```

**Problème :** Certaines migrations contiennent plusieurs commandes SQL qui ne peuvent pas être exécutées ensemble dans un prepared statement via `sqlx::query()`.

**Migrations affectées :**
- `20251230_optimize_audio_search_cache.sql` (tentative de créer `run_audio_cache_cleanup()`)
- `20260114_fix_image_search_to_tsvector_error.sql`
- `20251230_optimize_search_performance_final.sql`
- Plusieurs autres migrations avec plusieurs commandes

**Solution :** La fonction `execute_multiple_sql_commands()` devrait gérer cela, mais elle semble échouer pour certaines migrations. Vérifier que les blocs `DO $$` sont correctement parsés.

---

### 6. **Fonction `run_audio_cache_cleanup()` Non Créée**

**Erreur :**
```
function run_audio_cache_cleanup() does not exist
```

**Cause :** La création de la fonction a échoué à cause de "cannot insert multiple commands into a prepared statement" (ligne 2026-01-29 23:04:19).

**Solution :** Exécuter manuellement le SQL de création de la fonction, ou corriger le parsing dans `execute_multiple_sql_commands()`.

---

### 7. **Fonction `hybrid_image_search` Dupliquée**

**Erreur :**
```
function name "hybrid_image_search" is not unique
function "hybrid_image_search" already exists with same argument types
```

**Problème :** Plusieurs tentatives de créer la même fonction avec la même signature.

**Solution :** Utiliser `DROP FUNCTION IF EXISTS hybrid_image_search(...) CASCADE;` avec la signature complète avant de recréer.

---

### 8. **Tables Créées mais Non Commitées (Problème de Transaction)**

**Erreur :**
```
relation "delivery_product_suggestions" does not exist
relation "covoiturage_insurance" does not exist
relation "reservation_qr_codes" does not exist
relation "loyalty_transactions" does not exist
relation "chat_support_sessions" does not exist
relation "chat_support_messages" does not exist
relation "services_search_cache" does not exist
relation "active_products_cache" does not exist
```

**Problème :** Les tables/vues sont créées mais immédiatement référencées dans la même transaction, ce qui cause des erreurs car elles ne sont pas encore visibles.

**Cause probable :** Les migrations sont exécutées en parallèle ou dans des transactions séparées, et les index/commentaires sont créés avant que la table ne soit commitée.

**Solution :** S'assurer que les CREATE TABLE et CREATE INDEX sont dans la même transaction, ou utiliser `CREATE TABLE IF NOT EXISTS` et `CREATE INDEX IF NOT EXISTS` de manière idempotente.

---

### 9. **Partitionnement sur Tables Non Partitionnées**

**Erreur :**
```
"delivery_tracking_points" is not partitioned
"delivery_status_events" is not partitioned
```

**Problème :** Tentative de créer des partitions sur des tables qui ne sont pas déclarées comme partitionnées.

**Solution :** 
- Soit créer les tables comme partitionnées dès le départ
- Soit vérifier si la table est partitionnée avant de créer des partitions

---

### 10. **Index avec Fonction Non IMMUTABLE**

**Erreur :**
```
functions in index predicate must be marked IMMUTABLE
```

**Problème :** Utilisation de `NOW()` dans un prédicat d'index :
```sql
CREATE INDEX ... WHERE ... AND next_attempt_at <= NOW();  -- ❌ NOW() n'est pas IMMUTABLE
```

**Solution :** Retirer la condition `NOW()` du prédicat ou utiliser une autre approche.

---

### 11. **Vue : Changement de Type de Colonne**

**Erreur :**
```
cannot change data type of view column "user_name" from character varying to text
```

**Problème :** Tentative de modifier le type d'une colonne de vue existante.

**Solution :** Supprimer la vue avant de la recréer :
```sql
DROP VIEW IF EXISTS product_comments_view;
CREATE OR REPLACE VIEW product_comments_view AS ...;
```

---

## 📊 Résumé des Problèmes par Catégorie

| Catégorie | Nombre | Gravité |
|-----------|--------|---------|
| Syntaxe CREATE TRIGGER | 6+ | 🔴 Critique |
| Tables manquantes | 2 | 🔴 Critique |
| Colonne gps manquante | 4+ | 🔴 Critique |
| Syntaxe INDEX MySQL | 3 | 🟠 Important |
| Multiple commands | 4+ | 🟠 Important |
| Fonction dupliquée | 1 | 🟡 Moyen |
| Tables non commitées | 8+ | 🟠 Important |
| Partitionnement | 2 | 🟡 Moyen |
| Index IMMUTABLE | 1 | 🟡 Moyen |
| Vue type colonne | 1 | 🟡 Moyen |

---

## 🔧 Actions Correctives Recommandées

### Priorité 1 (Critique - Bloque les migrations)

1. **Corriger les CREATE TRIGGER** dans les migrations
2. **Créer les tables manquantes** (`products`, `reservations`) ou retirer les références
3. **Ajouter la colonne `gps`** à `services` ou corriger les références

### Priorité 2 (Important - Cause des erreurs)

4. **Corriger la syntaxe INDEX** dans CREATE TABLE
5. **Améliorer `execute_multiple_sql_commands()`** pour mieux gérer les blocs DO $$
6. **S'assurer que les tables sont commitées** avant de créer les index

### Priorité 3 (Moyen - Améliorations)

7. **Corriger le DROP FUNCTION** pour `hybrid_image_search` avec signature complète
8. **Vérifier le partitionnement** avant de créer des partitions
9. **Retirer NOW()** des prédicats d'index
10. **DROP VIEW avant CREATE OR REPLACE** pour les vues

---

## 🔍 Vérifications à Effectuer

1. ✅ Vérifier si la table `products` doit exister ou si c'est une erreur de référence
2. ✅ Vérifier si `reservations` doit être créée ou si c'est `bus_reservations`/`covoiturage_reservations`
3. ✅ Vérifier si la colonne `gps` existe dans `services` ou si elle est dans `data` JSONB
4. ✅ Vérifier l'ordre d'exécution des migrations pour éviter les dépendances circulaires
5. ✅ Vérifier que `execute_multiple_sql_commands()` parse correctement tous les blocs DO $$

---

## 📝 Notes

- Les erreurs se produisent lors de l'exécution de la migration `0000_create_all_tables.sql` via `execute_multiple_sql_commands()`
- Certaines migrations sont exécutées en parallèle, causant des problèmes de visibilité des tables
- La fonction `run_audio_cache_cleanup()` n'a pas été créée à cause d'une erreur de parsing

