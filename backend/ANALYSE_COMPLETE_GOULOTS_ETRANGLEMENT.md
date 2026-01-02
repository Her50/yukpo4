# 🔍 Analyse complète des goulots d'étranglement - Recherche (>10s)

## 📊 Timeline complète d'une recherche "chaussures" (d'après les logs)

```
04:29:07.695 - [RECHERCHE_DIRECTE] Début recherche "chaussures"
04:29:07.700 - Requête vectorielle optimisée → 12.4ms → 0 résultats ❌
04:29:07.713 - Fallback trigram → 788ms → 0 résultats ❌
04:29:09.907 - ⚠️ DÉBUT keyword_search_with_gps (requête complexe)
04:29:14.251 - ⚠️ FIN keyword_search_with_gps → 4.34 secondes ⚠️
04:29:14.615 - Réponse complète → 7.7s total
```

**Total observé** : **7.7 secondes** (mais logs montrent jusqu'à **8.1s**)

---

## 🎯 GOULOT #1 : Requête SQL `keyword_search_with_gps` (4.46s)

### Localisation
- **Fichier** : `backend/src/services/native_search_service.rs:1112-1342`
- **Fonction** : `keyword_search_with_gps()`
- **Temps** : **4.46248377s** (4462ms)

### Problèmes identifiés

#### 1.1. **14 PRIORITÉS DE SCORING avec `jsonb_array_elements` répétés**

**Code problématique** (lignes 1160-1293) :
```sql
GREATEST(
    COALESCE(ac.ac_score, 0.0),
    CASE WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(...) AS product
        WHERE LOWER(COALESCE(product->>'nom_produit', ...)) = LOWER($1)
    ) THEN 100.0
    WHEN EXISTS (
        SELECT 1 FROM jsonb_array_elements(...) AS product  -- ⚠️ MÊME jsonb_array_elements répété
        WHERE COALESCE(product->>'nom_produit', ...) ILIKE $1 || '%'
    ) THEN 80.0
    -- ... 12 autres priorités similaires
    END
)::REAL as keyword_score
```

**Impact** :
- Chaque `jsonb_array_elements` décompose le tableau JSON en lignes
- Pour un service avec 5 produits, cette opération est exécutée **14 fois**
- **14 × 5 = 70 opérations** de décomposition JSON par service
- Si 100 services sont évalués : **7000 opérations** de décomposition

**Temps estimé** : **~3.5s** (78% du temps total)

#### 1.2. **Calculs `to_tsvector` et `plainto_tsquery` répétés**

**Code problématique** (lignes 1267-1290) :
```sql
WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(...) AS product
    WHERE to_tsvector('french', COALESCE(product->>'nom_produit', ...)) 
          @@ plainto_tsquery('french', $1)
) THEN 25.0
```

**Impact** :
- `to_tsvector('french', ...)` est calculé **pour chaque produit** dans chaque priorité
- `plainto_tsquery('french', $1)` est recalculé **14 fois** (une par priorité)
- Ces opérations sont coûteuses (analyse lexicale, tokenisation)

**Temps estimé** : **~0.5s** (11% du temps total)

#### 1.3. **WHERE clause avec EXISTS multiples**

**Code problématique** (lignes 1299-1337) :
```sql
WHERE s.is_active = true
AND (
    ac.service_id IS NOT NULL
    OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(...) AS product
        WHERE (
            LOWER(COALESCE(product->>'nom_produit', ...)) = LOWER($1)
            OR COALESCE(product->>'nom_produit', ...) ILIKE $1 || '%'
            OR COALESCE(product->>'nom_produit', ...) ILIKE '%' || $1 || '%'
            OR to_tsvector('french', ...) @@ plainto_tsquery('french', $1)
            -- ... 4 autres conditions
        )
    )
    OR LOWER(COALESCE(s.data->'titre_service'->>'valeur', '')) = LOWER($1)
    OR COALESCE(s.data->'titre_service'->>'valeur', '') ILIKE $1 || '%'
    -- ... 8 autres conditions
)
```

**Impact** :
- PostgreSQL doit évaluer **toutes ces conditions** pour chaque service
- Les `EXISTS` avec `jsonb_array_elements` sont particulièrement coûteux
- Pas de limite sur le nombre de services évalués **avant** le scoring

**Temps estimé** : **~0.4s** (9% du temps total)

#### 1.4. **Pas de limite sur services évalués**

**Problème** :
- La requête évalue **TOUS les services actifs** avant de limiter à 50
- Si 10,000 services actifs : tous sont évalués, puis seulement 50 sont retournés

**Temps estimé** : **~0.06s** (1% du temps total, mais impacte les autres opérations)

---

## 🎯 GOULOT #2 : Requête vectorielle optimisée retourne 0 résultats (12.4ms → fallback)

### Localisation
- **Fichier** : `backend/src/services/native_search_service.rs:432-507`
- **Fonction** : `fulltext_search_with_gps()` (branche vectorielle)
- **Temps** : **12.4ms** (rapide mais inefficace)

### Problème
La requête vectorielle est **rapide** (12.4ms) mais retourne **0 résultats**, ce qui déclenche le fallback vers `keyword_search_with_gps` (4.46s).

**Code** (lignes 432-507) :
```sql
WITH autocomplete_matches AS (
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.usage_count,
        calculate_best_vector_match_score(
            ac.normalized_characteristic_vector,
            ac.normalized_full_vector,
            $1::TEXT[]
        ) + (ac.usage_count::REAL * 0.5) as final_score
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
      AND ac.identifiant_base = 'produits'
      AND ac.is_real_product = TRUE
      AND (
          ac.normalized_characteristic_vector && $1::TEXT[]
          OR ac.normalized_full_vector && $1::TEXT[]
      )
    LIMIT 500
)
```

**Problème identifié** :
- La fonction `calculate_best_vector_match_score` peut ne pas matcher "chaussures" si les vecteurs normalisés ne contiennent pas exactement ce mot
- Le filtre `&&` (overlap) peut être trop strict

**Impact** : **-4.5s** si cette requête trouvait des résultats (éviterait le fallback)

---

## 🎯 GOULOT #3 : Requête trigram (788ms)

### Localisation
- **Fichier** : `backend/src/services/native_search_service.rs:812-997`
- **Fonction** : `trigram_search_with_gps()`
- **Temps** : **788.972406ms** (0.79s)

### Problème
La requête trigram est déclenchée en fallback mais retourne aussi 0 résultats.

**Code** (lignes 934-957) :
```sql
SELECT DISTINCT
    s.id,
    s.data,
    s.created_at,
    s.user_id,
    s.gps,
    s.category,
    GREATEST(
        similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1),
        similarity(COALESCE(s.data->'description'->>'valeur', ''), $1),
        similarity(COALESCE(s.data->'category'->>'valeur', ''), $1)
    )::REAL as trigram_score
FROM services s
WHERE s.is_active = true
AND (
    similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1) > 0.1
    OR similarity(COALESCE(s.data->'description'->>'valeur', ''), $1) > 0.1
    OR similarity(COALESCE(s.data->'category'->>'valeur', ''), $1) > 0.1
)
```

**Problème** :
- `similarity()` est coûteux (calcul de distance trigram)
- Pas d'index trigram sur les colonnes JSON
- Évalue tous les services actifs

**Impact** : **-0.8s** si optimisé ou si évité

---

## 🎯 GOULOT #4 : Enrichissement publicité (21ms)

### Localisation
- **Fichier** : `backend/src/services/publicite_search_service.rs:23-120`
- **Fonction** : `enrich_search_results_with_promotion()`
- **Temps** : **21.048811ms** (d'après logs)

### Code
```sql
SELECT 
    id,
    produits_indexes,
    zone_geographique,
    pub_lng,
    pub_lat,
    rayon_km
FROM publicites
WHERE status = 'active'
  AND date_fin > NOW()
  AND date_debut <= NOW()
ORDER BY date_debut DESC
LIMIT 1000
```

**Problème** :
- Requête exécutée **à chaque recherche** (même si cache)
- Pas de cache efficace (cache miss fréquent)
- LIMIT 1000 peut être excessif

**Impact** : **-0.02s** (négligeable mais peut être optimisé)

---

## 🎯 GOULOT #5 : Pipeline de recherche complet (séquentiel)

### Localisation
- **Fichier** : `backend/src/services/rechercher_besoin.rs:400-650`
- **Fonction** : `rechercher_besoin_direct()`

### Séquence d'exécution

```
1. extract_keywords_from_text()          → ~1ms
2. GlobalCacheService::get()             → ~5ms (cache miss)
3. NativeSearchService::intelligent_search()
   ├─ fulltext_search_with_gps()         → 12.4ms (0 résultats)
   ├─ trigram_search_with_gps()         → 788ms (0 résultats)
   └─ keyword_search_with_gps()         → 4462ms (3 résultats) ⚠️
4. Conversion résultats                  → ~10ms
5. Enrichissement média                  → ~50ms
6. Enrichissement publicité              → ~21ms
7. Tri final                             → ~1ms
8. GlobalCacheService::set()             → ~5ms
```

**Total** : **~5345ms** (5.3s) pour la recherche seule

**Problème** : **Tout est séquentiel** - pas de parallélisation

---

## 🎯 GOULOT #6 : Conversion et enrichissement des résultats

### Localisation
- **Fichier** : `backend/src/services/rechercher_besoin.rs:650-800`

### Code problématique
```rust
// Pour chaque résultat, récupérer média, prestataire, etc.
for result in native_results {
    // Récupération média (requête SQL par service)
    let media = sqlx::query("SELECT ... FROM media WHERE service_id = $1")
        .bind(service_id)
        .fetch_all(pool)
        .await?;
    
    // Récupération prestataire (requête SQL par service)
    let prestataire = sqlx::query("SELECT ... FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
}
```

**Problème** : **N+1 queries** - une requête par résultat

**Impact** : Si 3 résultats, **6 requêtes supplémentaires** (~50ms chacune = 300ms)

---

## 📊 Comparaison avec les géants (Google, Amazon, etc.)

### Google Search
- **Temps de réponse** : **< 100ms**
- **Stratégie** :
  - **Index pré-calculé** (inverted index)
  - **Cache multi-niveaux** (L1: mémoire, L2: Redis, L3: CDN)
  - **Parallélisation** (recherche sur plusieurs shards en parallèle)
  - **Scoring simplifié** (TF-IDF + PageRank pré-calculé)
  - **Pas de JSON parsing** (colonnes dénormalisées)

### Amazon Product Search
- **Temps de réponse** : **< 200ms**
- **Stratégie** :
  - **Elasticsearch** (index inversé spécialisé)
  - **Colonnes dénormalisées** (pas de JSON parsing)
  - **Scoring pré-calculé** (popularité, reviews, etc.)
  - **Cache agressif** (95%+ cache hit rate)

### Notre système actuel
- **Temps de réponse** : **~8000ms** (80× plus lent que Google)
- **Problèmes** :
  - ❌ JSON parsing à la volée (`jsonb_array_elements`)
  - ❌ Scoring complexe calculé en temps réel
  - ❌ Pas de colonnes dénormalisées
  - ❌ Cache inefficace (cache miss fréquent)
  - ❌ Pas de parallélisation
  - ❌ N+1 queries

---

## 🔍 Analyse de la logique du code

### ✅ Points positifs

1. **Architecture modulaire** : Services séparés (NativeSearchService, CacheService, etc.)
2. **Fallback intelligent** : Si une méthode échoue, fallback vers une autre
3. **Support multi-langue** : Détection automatique de langue
4. **Filtrage GPS** : Support de la géolocalisation

### ❌ Problèmes de logique

#### 1. **Scoring trop complexe** (14 priorités)

**Problème** : 14 priorités différentes avec des scores arbitraires (100, 80, 70, 60, 55, 45, 50, 40, 35, 30, 25, 20, 15, 5, 2)

**Solution** : Simplifier à 3-4 priorités :
- **Priorité 1** : Match exact dans `autocomplete_characteristics` (score: 100)
- **Priorité 2** : Match dans nom_produit (score: 80)
- **Priorité 3** : Match dans titre_service (score: 60)
- **Priorité 4** : Match dans description (score: 40)

#### 2. **Pas de pré-filtrage efficace**

**Problème** : Tous les services actifs sont évalués avant le scoring

**Solution** : Pré-filtrer avec une requête rapide (utilise les index GIN) :
```sql
WITH quick_filter AS (
    SELECT s.id
    FROM services s
    WHERE s.is_active = true
    AND (
        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) 
        @@ plainto_tsquery('french', $1)
        OR EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac
            WHERE ac.service_id = s.id
            AND ac.valeur ILIKE '%' || $1 || '%'
            LIMIT 1
        )
    )
    LIMIT 100  -- ✅ LIMITER à 100 services max
)
```

#### 3. **jsonb_array_elements répété 14 fois**

**Problème** : Même opération répétée 14 fois par service

**Solution** : Pré-calculer dans une CTE :
```sql
WITH product_scores AS (
    SELECT 
        s.id as service_id,
        product->>'nom_produit' as nom_produit,
        CASE 
            WHEN LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER($1) THEN 100.0
            WHEN COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE $1 || '%' THEN 80.0
            WHEN COALESCE(product->>'nom_produit', product->>'nom', '') ILIKE '%' || $1 || '%' THEN 40.0
            ELSE 0.0
        END as product_score
    FROM services s
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE s.is_active = true
),
best_product_per_service AS (
    SELECT DISTINCT ON (service_id)
        service_id,
        MAX(product_score) as max_product_score
    FROM product_scores
    GROUP BY service_id
)
-- Ensuite utiliser max_product_score dans le SELECT final
```

#### 4. **Pas de cache efficace**

**Problème** : Cache miss fréquent (d'après logs : `[GlobalCache] ❌ Cache miss`)

**Solution** :
- Augmenter TTL du cache (actuellement 600s, passer à 3600s)
- Utiliser cache multi-niveaux (mémoire L1 + Redis L2)
- Pré-chauffer le cache avec recherches populaires

#### 5. **N+1 queries pour enrichissement**

**Problème** : Une requête par résultat pour média/prestataire

**Solution** : Batch queries :
```rust
let service_ids: Vec<i32> = results.iter().map(|r| r.service_id).collect();
let media_map: HashMap<i32, Vec<Media>> = sqlx::query(
    "SELECT service_id, ... FROM media WHERE service_id = ANY($1)"
)
.bind(&service_ids)
.fetch_all(pool)
.await?
.into_iter()
.group_by(|m| m.service_id)
.collect();
```

---

## 📈 Temps d'exécution détaillés (estimations)

| Zone | Temps actuel | Temps optimisé | Gain |
|------|--------------|----------------|------|
| **keyword_search_with_gps** | 4462ms | 1000ms | **-3462ms** |
| ├─ jsonb_array_elements répétés | 3500ms | 200ms | **-3300ms** |
| ├─ to_tsvector répétés | 500ms | 100ms | **-400ms** |
| ├─ WHERE clause complexe | 400ms | 100ms | **-300ms** |
| └─ Pas de limite services | 62ms | 0ms | **-62ms** |
| **trigram_search** | 788ms | 200ms | **-588ms** |
| **Enrichissement publicité** | 21ms | 5ms | **-16ms** |
| **N+1 queries** | 300ms | 50ms | **-250ms** |
| **Cache miss** | 5ms | 1ms | **-4ms** |
| **TOTAL** | **5576ms** | **1256ms** | **-4320ms** |

**Gain total estimé** : **-4.3s** (de 7.7s à **~1.3s**)

---

## 🎯 Plan d'action prioritaire

### Phase 1 : Quick wins (gain immédiat ~4s)

1. ✅ **Simplifier scoring** : 14 priorités → 4 priorités
2. ✅ **Pré-calculer product_scores** : CTE avec jsonb_array_elements une seule fois
3. ✅ **Pré-filtrer services** : LIMIT 100 avant scoring
4. ✅ **Batch queries** : Éliminer N+1 queries

**Gain estimé** : **-4.0s** (de 7.7s à **~3.7s**)

### Phase 2 : Optimisations avancées (gain supplémentaire ~2s)

5. ✅ **Améliorer requête vectorielle** : Trouver des résultats pour éviter fallback
6. ✅ **Optimiser trigram** : Index trigram sur colonnes JSON
7. ✅ **Cache agressif** : TTL 3600s, pré-chauffage

**Gain estimé** : **-2.0s** (de 3.7s à **~1.7s**)

### Phase 3 : Refactoring majeur (gain maximum ~1s)

8. ✅ **Colonnes dénormalisées** : Extraire nom_produit, description_produit dans colonnes séparées
9. ✅ **Index spécialisés** : GIN sur colonnes dénormalisées
10. ✅ **Parallélisation** : Recherche sur plusieurs shards en parallèle

**Gain estimé** : **-1.0s** (de 1.7s à **~0.7s** - niveau géants)

---

## 📝 Conclusion

**Le problème principal n'est PAS les index** (comme vous l'avez mentionné), mais :

1. **Complexité excessive** : 14 priorités de scoring avec jsonb_array_elements répétés
2. **Pas de pré-filtrage** : Tous les services évalués avant scoring
3. **Calculs redondants** : to_tsvector et plainto_tsquery répétés
4. **N+1 queries** : Enrichissement séquentiel
5. **Cache inefficace** : Cache miss fréquent

**Solution immédiate** : Implémenter Phase 1 pour réduire de **7.7s à ~3.7s** (gain de **52%**).

**Solution long terme** : Implémenter Phase 3 pour atteindre **< 1s** (niveau géants).


