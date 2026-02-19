# 📊 Analyse des Erreurs Base de Données - log-events-viewer-result (58).csv

**Date** : 2026-02-14  
**Période analysée** : 11:45:46 - 12:03:57 UTC

---

## ❌ Résumé Global

**Statut** : ⚠️ **ERREURS DÉTECTÉES**

**Nombre total d'erreurs** : **~100+ erreurs de syntaxe SQL**

---

## 🔍 Types d'Erreurs Identifiés

### 1. ❌ Erreurs de Parsing SQL (Majorité)

**Erreur** : `syntax error at end of input`

**Cause** : Le parsing SQL dans `auto_migrate.rs` tronque les commandes `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, etc.

**Impact** : Les migrations ne peuvent pas s'exécuter correctement, les tables/indexes ne sont pas créés.

**Exemples** :

1. **property_views** (ligne 2) - `CREATE TABLE` tronqué à la fin
2. **property_shares** (ligne 12) - `CREATE TABLE` tronqué
3. **family_profiles** (ligne 21) - `CREATE TABLE` tronqué
4. **recipes** (ligne 39) - `CREATE TABLE` tronqué
5. **menu_plans** (ligne 61) - `CREATE TABLE` tronqué
6. **planned_meals** (ligne 74) - `CREATE TABLE` tronqué
7. **recipe_favorites** (ligne 85) - `CREATE TABLE` tronqué
8. **shopping_lists** (ligne 92) - `CREATE TABLE` tronqué
9. **shopping_list_items** (ligne 104) - `CREATE TABLE` tronqué
10. **nutrition_analytics** (ligne 120) - `CREATE TABLE` tronqué
11. **plugin_marketplace** (ligne 134) - `CREATE TABLE` tronqué
12. **livres_scolaires** (ligne 158) - `CREATE TABLE` tronqué
13. **troc_livres_scolaires** (ligne 187) - `CREATE TABLE` tronqué
14. **chaines_troc_livres** (ligne 212) - `CREATE TABLE` tronqué
15. **offres_emploi** (ligne 227) - `CREATE TABLE` tronqué
16. **profils_candidats** (ligne 275) - `CREATE TABLE` tronqué
17. **candidatures** (ligne 317) - `CREATE TABLE` tronqué
18. **matching_offres_candidats** (ligne 341) - `CREATE TABLE` tronqué
19. **alertes_emploi** (ligne 363) - `CREATE TABLE` tronqué
20. **statistiques_offres** (ligne 382) - `CREATE TABLE` tronqué
21. **etablissements_scolaires** (ligne 400) - `CREATE TABLE` tronqué
22. **delivery_chat_messages** (ligne 435) - `CREATE TABLE` tronqué
23. **delivery_gamification_stats** (ligne 445) - `CREATE TABLE` tronqué
24. **delivery_badges** (ligne 456) - `CREATE TABLE` tronqué
25. **delivery_points_history** (ligne 467) - `CREATE TABLE` tronqué
26. **delivery_product_suggestions** (ligne 476) - `CREATE TABLE` tronqué
27. **user_documents** (ligne 489) - `CREATE TABLE` tronqué
28. **covoiturage_insurance** (ligne 506) - `CREATE TABLE` tronqué
29. **reservation_qr_codes** (ligne 521) - `CREATE TABLE` tronqué
30. **loyalty_transactions** (ligne 537) - `CREATE TABLE` tronqué
31. **loyalty_rewards** (ligne 547) - `CREATE TABLE` tronqué
32. **chat_support_sessions** (ligne 559) - `CREATE TABLE` tronqué
33. **chat_support_messages** (ligne 572) - `CREATE TABLE` tronqué
34. **bus_ticket_ratings** (ligne 582) - `CREATE TABLE` tronqué
35. **videos** (ligne 680) - `CREATE TABLE` tronqué
36. **user_preferences** (ligne 733) - `CREATE TABLE` tronqué
37. **video_generation_metrics** (ligne 753) - `CREATE TABLE` tronqué
38. **rate_limit_tracking** (ligne 772) - `CREATE TABLE` tronqué
39. **message_reactions** (ligne 783) - `CREATE TABLE` tronqué

**Et de nombreux `CREATE INDEX`, `ALTER TABLE`, `COMMENT ON INDEX`, `CREATE MATERIALIZED VIEW` tronqués.**

---

### 2. ❌ Erreur Index avec CURRENT_DATE

**Erreur** (ligne 273) :
```
ERROR: functions in index predicate must be marked IMMUTABLE
STATEMENT: CREATE INDEX IF NOT EXISTS idx_offres_date_limite ON offres_emploi(date_limite_candidature, statut) WHERE date_limite_candidature >= CURRENT_DATE AND statut = 'active';
```

**Cause** : `CURRENT_DATE` n'est pas IMMUTABLE (change chaque jour).

**Solution** : Utiliser une fonction IMMUTABLE ou créer l'index sans prédicat temporel.

---

### 3. ❌ Colonnes Manquantes

#### a) `live_session_analytics.last_synced_at` (ligne 792)

**Erreur** :
```
ERROR: column "last_synced_at" does not exist
STATEMENT: CREATE INDEX IF NOT EXISTS idx_live_session_analytics_last_synced ON live_session_analytics(last_synced_at)
```

**Solution** : Ajouter la colonne `last_synced_at` à `live_session_analytics` ou supprimer l'index.

#### b) `global_promo_products.highlighted` (ligne 794)

**Erreur** :
```
ERROR: column "highlighted" does not exist
STATEMENT: CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_products_highlighted_priority 
         ON global_promo_products(highlighted DESC, priority_score DESC)
```

**Solution** : Ajouter la colonne `highlighted` à `global_promo_products` ou supprimer l'index.

---

### 4. ❌ Erreur GROUP BY dans Vue Matérialisée

**Erreur** (ligne 709) :
```
ERROR: column "tag.tag" must appear in the GROUP BY clause or be used in an aggregate function
STATEMENT: CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    ...
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
```

**Cause** : La colonne `tag` issue de `unnest()` doit être dans le `GROUP BY`.

**Solution** : Ajouter `GROUP BY tag` à la requête.

---

### 5. ❌ Multiple Commands dans Prepared Statement

**Erreur** (ligne 825) :
```
ERROR: cannot insert multiple commands into a prepared statement
STATEMENT: DROP FUNCTION IF EXISTS run_audio_cache_cleanup();
           CREATE OR REPLACE FUNCTION run_audio_cache_cleanup()
           ...
```

**Cause** : Le parsing SQL traite plusieurs commandes séparées par `;` comme une seule requête.

**Solution** : Séparer les commandes en requêtes individuelles.

---

### 6. ⚠️ Connexions Reset (Normal)

**Messages** (lignes 988-995) :
```
LOG: could not receive data from client: Connection reset by peer
```

**Statut** : ⚠️ Normal - Connexions fermées par le client (timeout, redémarrage, etc.)

---

### 7. ✅ Checkpoints PostgreSQL (Normal)

**Messages** (lignes 996-1003) :
```
LOG: checkpoint starting: time
LOG: checkpoint complete: wrote X buffers...
```

**Statut** : ✅ Normal - Checkpoints automatiques de PostgreSQL

---

## 📊 Statistiques des Erreurs

| Type d'Erreur | Nombre | Priorité |
|---------------|--------|----------|
| `syntax error at end of input` | ~90+ | 🔴 CRITIQUE |
| `column does not exist` | 2 | 🟡 MOYEN |
| `functions in index predicate must be marked IMMUTABLE` | 1 | 🟡 MOYEN |
| `GROUP BY clause` | 1 | 🟡 MOYEN |
| `multiple commands` | 1 | 🟡 MOYEN |
| **TOTAL** | **~95 erreurs** | |

---

## 🔧 Solutions Requises

### Solution 1 : Améliorer le Parsing SQL (CRITIQUE)

Le problème principal est que `auto_migrate.rs` tronque les commandes SQL. Il faut :

1. ✅ Améliorer la logique de parsing pour détecter correctement la fin des blocs SQL
2. ✅ Gérer les commandes multi-lignes avec parenthèses imbriquées
3. ✅ Séparer correctement les commandes multiples séparées par `;`

### Solution 2 : Corriger les Colonnes Manquantes

#### Ajouter `last_synced_at` à `live_session_analytics`

```sql
ALTER TABLE live_session_analytics 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
```

#### Ajouter `highlighted` à `global_promo_products`

```sql
ALTER TABLE global_promo_products 
ADD COLUMN IF NOT EXISTS highlighted BOOLEAN DEFAULT FALSE;
```

### Solution 3 : Corriger l'Index avec CURRENT_DATE

```sql
-- Option 1 : Supprimer le prédicat temporel
DROP INDEX IF EXISTS idx_offres_date_limite;
CREATE INDEX IF NOT EXISTS idx_offres_date_limite 
ON offres_emploi(date_limite_candidature, statut) 
WHERE statut = 'active';

-- Option 2 : Utiliser une fonction IMMUTABLE (si nécessaire)
-- Créer une fonction wrapper IMMUTABLE
```

### Solution 4 : Corriger la Vue Matérialisée hashtag_stats

```sql
DROP MATERIALIZED VIEW IF EXISTS hashtag_stats_materialized;
CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    SUM(v.view_count) as total_views,
    SUM(v.like_count) as total_likes,
    SUM(v.save_count) as total_saves,
    (
        SUM(v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) 
        / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(v.created_at))) / 3600, 1)
    ) as trend_score,
    MAX(v.created_at) as last_video_at
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
GROUP BY tag;  -- ✅ Ajouter GROUP BY
```

### Solution 5 : Séparer les Commandes Multiples

Pour la fonction `run_audio_cache_cleanup()`, exécuter séparément :
1. `DROP FUNCTION IF EXISTS run_audio_cache_cleanup();`
2. `CREATE OR REPLACE FUNCTION run_audio_cache_cleanup() ...`

---

## 🎯 Priorités d'Action

### 🔴 PRIORITÉ 1 : Améliorer le Parsing SQL

**Impact** : Bloque la création de ~90+ tables/indexes/fonctions

**Action** : Corriger `backend/src/migrations/auto_migrate.rs` pour mieux parser les commandes SQL multi-lignes.

### 🟡 PRIORITÉ 2 : Corriger les Colonnes Manquantes

**Impact** : 2 index ne peuvent pas être créés

**Action** : Ajouter les colonnes manquantes ou supprimer les index.

### 🟡 PRIORITÉ 3 : Corriger les Autres Erreurs

**Impact** : 3 erreurs spécifiques (index IMMUTABLE, GROUP BY, multiple commands)

**Action** : Corriger individuellement.

---

## 📝 Conclusion

**Le problème principal** est le **parsing SQL défaillant** qui tronque les commandes. C'est le même problème que précédemment, mais avec beaucoup plus de tables affectées.

**Recommandation** : 
1. Désactiver temporairement les auto-migrations (déjà fait)
2. Exécuter les migrations manuellement depuis EC2 (déjà fait)
3. **Améliorer le parsing SQL dans `auto_migrate.rs`** pour éviter ce problème à l'avenir

---

## 🔗 Fichiers Concernés

- `backend/src/migrations/auto_migrate.rs` - Logique de parsing SQL
- Toutes les migrations SQL dans `backend/migrations/` - Commandes tronquées



