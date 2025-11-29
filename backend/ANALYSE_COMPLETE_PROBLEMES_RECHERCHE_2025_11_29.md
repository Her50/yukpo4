# 🔍 Analyse Complète des Problèmes de Recherche - 29 Novembre 2025

## 📋 Résumé Exécutif

**Problèmes critiques identifiés :**
1. ❌ **Erreur structure requête GPS** : `search_services_gps_final` échoue systématiquement
2. ❌ **Index non utilisés** : Les index existants ne sont pas utilisés par les requêtes
3. ❌ **Logique de recherche défectueuse** : Filtre sur service AVANT d'extraire les produits
4. ❌ **Requêtes très lentes** : 4-22 secondes pour des recherches simples
5. ❌ **0 résultats** : Produits existants non trouvés (ex: "avensis", "glace")

---

## 🔴 PROBLÈME 1 : Erreur Structure Requête GPS

### Symptômes
```
[NativeSearch] ⚠️ Erreur structure requête GPS - Fallback vers recherche sans GPS. 
Erreur: error returned from database: structure of query does not match function result type
```

### Cause
Le code Rust attend 7 colonnes de `search_services_gps_final` :
- `service_id`
- `titre_service`
- `category`
- `gps_coords`
- `distance_km`
- `relevance_score`
- `gps_source`

Mais la fonction PostgreSQL retourne probablement une structure différente ou incompatible.

### Impact
- ❌ Recherches GPS échouent systématiquement
- ❌ Fallback vers recherche non optimisée (4+ secondes)
- ❌ 0 résultats pour "avensis" malgré des requêtes complexes

### Solution
Vérifier et corriger la signature de `search_services_gps_final` pour correspondre exactement aux colonnes attendues par le code Rust.

---

## 🔴 PROBLÈME 2 : Index Non Utilisés

### Symptômes
- Requêtes prennent 4-22 secondes malgré de nombreux index créés
- Logs montrent `rows_returned: 0` après des requêtes complexes

### Analyse des Index Existants

#### Index Créés (109 index trouvés dans les migrations)
1. **Index GIN sur JSONB** : `idx_services_data_search_gin`, `idx_services_produits_gin`
2. **Index Trigram** : `idx_services_titre_service_trgm`, `idx_services_description_trgm`
3. **Index Full-Text** : `idx_services_titre_service_fts`, `idx_services_description_fts`
4. **Index Autocomplete** : `idx_autocomplete_characteristics_vector_gin`

### Pourquoi les Index ne Fonctionnent PAS

#### ❌ Problème 1 : Index GIN JSONB ne supporte pas ILIKE efficacement
```sql
-- Index créé :
CREATE INDEX idx_services_data_search_gin ON services USING GIN (data jsonb_path_ops);

-- Requête utilisée :
WHERE s.data->'titre_service'->>'valeur' ILIKE '%avensis%'
```

**Explication** : Les index GIN `jsonb_path_ops` sont optimisés pour les opérateurs `@>`, `?`, `?&`, `?|`, mais **PAS pour ILIKE sur des chemins JSONB complexes**. PostgreSQL ne peut pas utiliser cet index pour `data->'titre_service'->>'valeur' ILIKE`.

#### ❌ Problème 2 : Index Trigram ne supporte pas unaccent()
```sql
-- Index créé :
CREATE INDEX idx_services_titre_service_trgm 
ON services USING GIN ((COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '')) gin_trgm_ops);

-- Requête utilisée :
WHERE unaccent(s.data->'titre_service'->>'valeur') ILIKE '%avensis%'
```

**Explication** : L'index trigram est sur la valeur SANS `unaccent()`, mais la requête utilise `unaccent()`. PostgreSQL ne peut pas utiliser l'index car l'expression ne correspond pas.

#### ❌ Problème 3 : Index Full-Text ne supporte pas ILIKE
```sql
-- Index créé :
CREATE INDEX idx_services_titre_service_fts 
ON services USING GIN (to_tsvector('french', COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '')));

-- Requête utilisée :
WHERE s.data->'titre_service'->>'valeur' ILIKE '%avensis%'
```

**Explication** : Les index `tsvector` sont pour `@@` (full-text search), **PAS pour ILIKE**. La requête devrait utiliser `to_tsvector(...) @@ plainto_tsquery('french', 'avensis')` pour utiliser l'index.

#### ❌ Problème 4 : WHERE filtre AVANT extraction produits
```sql
-- Requête actuelle (PROBLÉMATIQUE) :
WITH products_extracted AS (
    SELECT s.id, ...
    FROM services s
    WHERE s.is_active = true
    AND (s.data->'titre_service'->>'valeur' ILIKE '%avensis%' ...)  -- ❌ Filtre AVANT extraction
    ...
)
```

**Explication** : La requête filtre d'abord sur les champs service (`titre_service`, `description`, `category`), puis extrait les produits. Si un produit contient "avensis" mais que le service ne contient pas "avensis" dans son titre/description/category, il ne sera **JAMAIS** trouvé, même si l'index sur produits existe.

---

## 🔴 PROBLÈME 3 : Logique de Recherche Défectueuse

### Requête Actuelle (PROBLÉMATIQUE)

```sql
WITH products_extracted AS (
    -- ❌ PROBLÈME : Filtre sur service AVANT d'extraire les produits
    SELECT s.id as service_id,
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            ...
        END as products_array
    FROM services s
    WHERE s.is_active = true
    -- ❌ Ce filtre élimine les services dont les produits contiennent "avensis"
    --    mais dont le titre/description/category ne contient pas "avensis"
    AND (s.data->'titre_service'->>'valeur' ILIKE '%avensis%' 
         OR s.data->'description'->>'valeur' ILIKE '%avensis%' 
         OR s.data->'category'->>'valeur' ILIKE '%avensis%' ...)
),
products_scored AS (
    -- ✅ Score calculé correctement, mais seulement sur les produits déjà filtrés
    SELECT pe.service_id, ...
    FROM products_extracted pe,
        jsonb_array_elements(pe.products_array) AS product
    WHERE product->>'nom' ILIKE '%avensis%' ...
)
```

### Pourquoi ça ne trouve PAS les produits

**Exemple concret** :
- Service ID 123 : `titre_service = "Vente de voitures"`, `produits = [{"nom": "Toyota Avensis 2002"}]`
- Recherche : "avensis"

**Résultat** :
1. ✅ `products_extracted` : Service 123 est extrait (car `titre_service` ne contient pas "avensis", mais le filtre est trop large)
2. ❌ **ATTENDEZ** : Le filtre `WHERE ... ILIKE '%avensis%'` élimine le service 123 car ni `titre_service`, ni `description`, ni `category` ne contient "avensis"
3. ❌ Le produit "Toyota Avensis 2002" n'est **JAMAIS** examiné

### Solution Requise

```sql
WITH products_extracted AS (
    -- ✅ CORRIGÉ : Extraire TOUS les services actifs avec produits
    SELECT s.id as service_id,
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            ...
        END as products_array
    FROM services s
    WHERE s.is_active = true
    -- ✅ PAS de filtre ici, on extrait TOUS les produits
),
products_scored AS (
    -- ✅ Filtrer sur les PRODUITS, pas sur les services
    SELECT pe.service_id, ...
    FROM products_extracted pe,
        jsonb_array_elements(pe.products_array) AS product
    WHERE (
        -- Recherche dans les produits
        product->>'nom' ILIKE '%avensis%' 
        OR product->>'categorie' ILIKE '%avensis%'
        OR product->>'description' ILIKE '%avensis%'
        OR product->>'marque' ILIKE '%avensis%'
        OR product->>'modele' ILIKE '%avensis%'
        ...
    )
    -- ✅ OU recherche dans les champs service (pour services sans produits)
    OR pe.service_id IN (
        SELECT s.id FROM services s
        WHERE s.is_active = true
        AND (s.data->'titre_service'->>'valeur' ILIKE '%avensis%' ...)
    )
)
```

---

## 🔴 PROBLÈME 4 : Requêtes Très Lentes

### Temps Observés dans les Logs
- Recherche "avensis" : **20.9 secondes** (0 résultats)
- Recherche "glace" : **10.5 secondes** (1 résultat après fallback)
- Requête SQL lente : **4.2 secondes** (0 résultats)

### Causes Identifiées

1. **Requêtes ILIKE multiples** : 20+ conditions ILIKE dans une seule requête
2. **Pas d'utilisation d'index** : PostgreSQL fait des scans complets de table
3. **CTE complexes** : Multiples CTE avec `jsonb_array_elements` et `unnest`
4. **Fonctions non indexées** : `unaccent()`, `extract_all_product_text()`, `similarity()`

### Requête Lente Typique

```sql
-- ❌ PROBLÈME : 20+ conditions ILIKE, aucune ne peut utiliser d'index
WHERE (s.data->'titre_service'->>'valeur' ILIKE '%avensis%' 
       OR s.data->'description'->>'valeur' ILIKE '%avensis%' 
       OR s.data->'category'->>'valeur' ILIKE '%avensis%' 
       OR unaccent(s.data->'titre_service'->>'valeur') ILIKE '%avensis%'
       OR unaccent(s.data->'description'->>'valeur') ILIKE '%avensis%'
       OR unaccent(s.data->'category'->>'valeur') ILIKE '%avensis%'
       OR s.data->'titre_service'->>'valeur' ILIKE '%aven%'
       OR s.data->'description'->>'valeur' ILIKE '%aven%'
       ... 15+ autres conditions ...)
```

**PostgreSQL ne peut pas utiliser d'index** car :
- `ILIKE '%avensis%'` (avec `%` au début) nécessite un scan complet
- `unaccent()` n'est pas indexé
- Expressions JSONB complexes (`data->'titre_service'->>'valeur'`) ne peuvent pas utiliser les index GIN efficacement

---

## 🔴 PROBLÈME 5 : Erreurs et Warnings dans les Logs

### Erreurs Critiques

#### 1. Redis Indisponible
```
⚠️ [Redis] Impossible d'obtenir une connexion: failed to lookup address information: Name or service not known
[CacheService] Redis indisponible pour set search:fulltext:...
```
**Impact** : Pas de cache, toutes les requêtes vont à la DB

#### 2. Connexions DB qui se terminent
```
terminating connection because of crash of another server process
ping on idle connection returned error: peer closed connection without sending TLS close_notify
```
**Impact** : Connexions instables, retries nécessaires, ralentissement

#### 3. SQLite Mobile Full
```
📱[MOBILE] [ERROR] CacheManager: database or disk is full (code 13 SQLITE_FULL)
```
**Impact** : Cache mobile ne fonctionne pas, requêtes répétées

### Warnings

#### 1. Requêtes Lentes
```
🐌 [SlowRequest] POST /api/search/direct -> 200 (22850 ms)
🚨 [VerySlowRequest] POST /api/search/direct -> 500 (10515 ms)
slow statement: execution time exceeded alert threshold (4.2s)
```

#### 2. Acquisition de Connexion Lente
```
acquired connection, but time to acquire exceeded slow threshold (2.1s)
```

---

## ✅ SOLUTIONS PROPOSÉES

### Solution 1 : Corriger la Logique de Recherche

**Changer l'ordre** : Extraire TOUS les produits actifs, puis filtrer sur les produits, pas sur les services.

```sql
WITH all_products AS (
    -- ✅ Extraire TOUS les produits de TOUS les services actifs
    SELECT 
        s.id as service_id,
        s.data,
        s.created_at,
        s.user_id,
        s.gps,
        s.category,
        jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) as product
    FROM services s
    WHERE s.is_active = true
),
matched_products AS (
    -- ✅ Filtrer sur les PRODUITS qui matchent
    SELECT DISTINCT
        ap.service_id,
        ap.data,
        ap.created_at,
        ap.user_id,
        ap.gps,
        ap.category,
        -- Score de pertinence
        CASE 
            WHEN LOWER(ap.product->>'nom') = LOWER($1) THEN 25.0
            WHEN ap.product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
            ...
        END as product_score
    FROM all_products ap
    WHERE (
        -- Recherche dans les champs produit
        ap.product->>'nom' ILIKE '%' || $1 || '%'
        OR ap.product->>'categorie' ILIKE '%' || $1 || '%'
        OR ap.product->>'description' ILIKE '%' || $1 || '%'
        OR ap.product->>'marque' ILIKE '%' || $1 || '%'
        OR ap.product->>'modele' ILIKE '%' || $1 || '%'
        ...
    )
)
SELECT * FROM matched_products
ORDER BY product_score DESC
LIMIT 100;
```

### Solution 2 : Utiliser Full-Text Search au lieu d'ILIKE

**Remplacer ILIKE par tsvector** pour utiliser les index full-text :

```sql
-- ✅ Utiliser les index full-text existants
WHERE to_tsvector('french', 
    COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
    COALESCE(s.data->'description'->>'valeur', '')
) @@ plainto_tsquery('french', $1)
```

### Solution 3 : Créer des Index Fonctionnels pour unaccent()

```sql
-- Créer fonction wrapper IMMUTABLE
CREATE OR REPLACE FUNCTION unaccent_immutable(text) 
RETURNS text AS $$
    SELECT unaccent('unaccent', $1);
$$ LANGUAGE sql IMMUTABLE;

-- Créer index avec unaccent
CREATE INDEX idx_services_titre_service_unaccent_trgm 
ON services USING GIN (unaccent_immutable(COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '')) gin_trgm_ops)
WHERE is_active = true;
```

### Solution 4 : Corriger search_services_gps_final

Vérifier la signature de la fonction et s'assurer qu'elle retourne exactement les 7 colonnes attendues.

---

## 📊 Statistiques des Problèmes

| Problème | Fréquence | Impact | Priorité |
|----------|-----------|--------|----------|
| Erreur structure requête GPS | 100% des recherches GPS | Critique | 🔴 P0 |
| Logique recherche défectueuse | 100% des recherches | Critique | 🔴 P0 |
| Index non utilisés | 100% des requêtes | Critique | 🔴 P0 |
| Requêtes lentes | 100% des recherches | Élevé | 🟠 P1 |
| Redis indisponible | 100% | Moyen | 🟡 P2 |
| Connexions DB instables | Fréquent | Moyen | 🟡 P2 |

---

## 🎯 Plan d'Action Immédiat

1. **P0 - URGENT** : Corriger la logique de recherche (extraire produits AVANT filtrage)
2. **P0 - URGENT** : Corriger `search_services_gps_final` ou désactiver temporairement
3. **P1** : Remplacer ILIKE par full-text search (tsvector)
4. **P1** : Créer index fonctionnels pour unaccent()
5. **P2** : Configurer Redis correctement
6. **P2** : Stabiliser les connexions DB

---

## 📝 Notes Techniques

### Pourquoi les Index GIN JSONB ne fonctionnent pas avec ILIKE

Les index GIN `jsonb_path_ops` sont optimisés pour :
- `@>` (contains)
- `?` (key exists)
- `?&` (all keys exist)
- `?|` (any key exists)

Mais **PAS** pour :
- `->>` (extract text)
- `ILIKE` (pattern matching)

Pour utiliser un index avec ILIKE sur JSONB, il faut :
1. Extraire la valeur dans un index fonctionnel
2. Utiliser un index trigram sur la valeur extraite

### Pourquoi unaccent() n'est pas indexé

Par défaut, `unaccent()` n'est pas marqué `IMMUTABLE` car elle dépend de la configuration. Pour créer un index avec `unaccent()`, il faut :
1. Créer une fonction wrapper `IMMUTABLE`
2. Utiliser cette fonction dans l'index

