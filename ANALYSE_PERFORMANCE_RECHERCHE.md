# 🔍 Analyse Performance Recherche - 2025-12-30

## 📊 État Actuel

### Temps de Recherche Observés (Logs)
- **Temps total** : **20.3 secondes** pour recherche "Veste"
- **Temps SQL** : **3.1 - 5.3 secondes** par requête
- **Nombre de requêtes lentes** : Plusieurs requêtes dépassent le seuil d'alerte (1s)

### Problèmes Identifiés

1. **Requête SQL Complexe** :
   - CTE multiples (4-5 CTE imbriquées)
   - `CROSS JOIN` avec `search_keywords_normalized` (peut être coûteux)
   - `calculate_vector_match_score_optimized` appelée **2 fois** par ligne (characteristic_vector + full_vector)
   - `DISTINCT ON` avec tri complexe

2. **Index Utilisés** :
   - ✅ Index GIN sur `normalized_characteristic_vector` : **CRÉÉ**
   - ✅ Index GIN sur `normalized_full_vector` : **CRÉÉ**
   - ✅ Index composite sur filtres : **CRÉÉ**

3. **Optimisations Déjà Appliquées** :
   - ✅ Matching vectoriel optimisé avec `calculate_vector_match_score_optimized`
   - ✅ Colonnes normalisées (accents supprimés)
   - ✅ Index GIN sur vecteurs normalisés
   - ✅ Filtrage rapide avec `&&` (overlap)

## 🎯 Optimisations Proposées

### 1. Simplifier la Requête SQL

**Problème** : La requête actuelle fait plusieurs passes :
- CTE `filtered_autocomplete` : Filtre avec `&&`
- CTE `vector_scores` : Calcule score 2 fois (characteristic + full)
- CTE `best_autocomplete_per_service` : Sélectionne meilleur match
- CTE `matched_services` : Union avec fallback
- Requête finale : Jointure + scoring

**Solution** : Réduire à 2-3 CTE maximum

```sql
-- Version simplifiée (1 seule passe de calcul de score)
WITH search_keywords_normalized AS (
    SELECT $1::TEXT[] as keywords
),
autocomplete_matches AS (
    SELECT 
        ac.service_id,
        ac.valeur,
        ac.usage_count,
        -- ✅ CALCUL SCORE EN UNE SEULE PASSE (pas de CROSS JOIN)
        GREATEST(
            COALESCE(calculate_vector_match_score_optimized(ac.normalized_characteristic_vector, $1::TEXT[]), 0.0),
            COALESCE(calculate_vector_match_score_optimized(ac.normalized_full_vector, $1::TEXT[]), 0.0)
        ) + (ac.usage_count::REAL * 0.5) as final_score
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
      AND ac.identifiant_base = 'produits'
      AND ac.is_real_product = TRUE
      -- ✅ FILTRE RAPIDE : && utilise index GIN
      AND (
          ac.normalized_characteristic_vector && $1::TEXT[]
          OR ac.normalized_full_vector && $1::TEXT[]
      )
),
best_autocomplete_per_service AS (
    SELECT DISTINCT ON (service_id)
        service_id,
        valeur,
        final_score
    FROM autocomplete_matches
    WHERE final_score > 0
    ORDER BY service_id, final_score DESC, usage_count DESC NULLS LAST
)
SELECT 
    s.id,
    s.data,
    s.created_at,
    s.user_id,
    s.gps,
    s.category,
    COALESCE(ac.final_score, 0.0)::REAL as fulltext_score
FROM best_autocomplete_per_service ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
  AND ($3::text IS NULL OR s.gps IS NULL OR s.gps = $3 OR s.gps LIKE $3 || '%' OR s.gps LIKE '%' || $3)
ORDER BY ac.final_score DESC
LIMIT 100;
```

### 2. Limiter le Nombre de Résultats dans les CTE

**Problème** : Les CTE intermédiaires peuvent retourner des milliers de lignes

**Solution** : Ajouter `LIMIT` dans les CTE intermédiaires

```sql
autocomplete_matches AS (
    ...
    LIMIT 500  -- Limiter à 500 matches max
)
```

### 3. Créer Index Composite pour Filtres Fréquents

**Problème** : Les filtres `is_active`, `identifiant_base`, `is_real_product` sont appliqués sur chaque ligne

**Solution** : Index composite déjà créé, mais vérifier qu'il est utilisé

```sql
-- Index déjà créé dans migration
CREATE INDEX idx_autocomplete_normalized_filters 
ON autocomplete_characteristics (is_real_product, identifiant_base) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';
```

### 4. Optimiser la Fonction `calculate_vector_match_score_optimized`

**Problème** : La fonction est appelée 2 fois par ligne (characteristic + full)

**Solution** : Créer une fonction qui calcule les deux scores en une seule passe

```sql
CREATE OR REPLACE FUNCTION calculate_best_vector_match_score(
    characteristic_vector_normalized TEXT[],
    full_vector_normalized TEXT[],
    search_keywords_normalized TEXT[]
)
RETURNS REAL AS $$
    SELECT GREATEST(
        COALESCE(calculate_vector_match_score_optimized(characteristic_vector_normalized, search_keywords_normalized), 0.0),
        COALESCE(calculate_vector_match_score_optimized(full_vector_normalized, search_keywords_normalized), 0.0)
    );
$$ LANGUAGE sql IMMUTABLE;
```

### 5. Utiliser Materialized View pour Cache

**Problème** : Les mêmes recherches sont répétées fréquemment

**Solution** : Créer une vue matérialisée pour les recherches fréquentes

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_search_results AS
SELECT 
    ac.service_id,
    ac.valeur as search_term,
    calculate_best_vector_match_score(
        ac.normalized_characteristic_vector,
        ac.normalized_full_vector,
        ARRAY[LOWER(ac.valeur)]
    ) as score
FROM autocomplete_characteristics ac
WHERE ac.usage_count > 10  -- Seulement recherches fréquentes
ORDER BY ac.usage_count DESC;

CREATE INDEX ON popular_search_results (search_term, score DESC);
```

## 📈 Résultats Attendus

- **Temps SQL** : **< 500ms** (au lieu de 3-5s)
- **Temps total** : **< 2s** (au lieu de 20s)
- **Amélioration** : **10x plus rapide**

## 🔄 Plan d'Implémentation

1. ✅ Créer fonction `calculate_best_vector_match_score`
2. ✅ Simplifier requête SQL (réduire CTE)
3. ✅ Ajouter LIMIT dans CTE intermédiaires
4. ✅ Tester avec EXPLAIN ANALYZE
5. ✅ Mesurer amélioration

