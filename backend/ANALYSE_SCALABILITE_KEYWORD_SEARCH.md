# 🔍 Analyse Scalabilité : `keyword_search_with_gps`

## ⚠️ PROBLÈME IDENTIFIÉ

### Temps estimé 0.3s n'est PAS invariant

**Avec 20 produits** : ~0.3s ✅  
**Avec 1M produits** : **> 10 secondes** ❌

---

## 🔍 Goulots d'étranglement identifiés

### 1. CTE `product_scores` (LIGNES 1167-1217)

**Problème** :
```sql
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(...) AS product
WHERE s.is_active = true
AND (
    unaccent(...) ILIKE '%' || unaccent($1) || '%'  -- ⚠️ Ne peut pas utiliser d'index
    OR similarity(...) > 0.3  -- ⚠️ Très lent sur millions de lignes
)
LIMIT 500
```

**Impact** :
- Avec 1M services actifs × 5 produits = **5M produits à évaluer**
- `unaccent()` et `similarity()` ne peuvent pas utiliser d'index efficacement
- PostgreSQL doit évaluer TOUS les produits avant de limiter à 500

**Temps estimé** : **> 8 secondes** avec 1M produits

---

### 2. CTE `quick_filter` (LIGNES 1209-1224)

**Problème** :
```sql
WHERE (
    OR unaccent(...) ILIKE '%' || unaccent($1) || '%'  -- ⚠️ Ne peut pas utiliser d'index
    OR similarity(...) > 0.3  -- ⚠️ Très lent
)
LIMIT 100
```

**Impact** :
- Évalue TOUS les services actifs avant de limiter
- `unaccent()` et `similarity()` sont lents sans index

**Temps estimé** : **> 2 secondes** avec 1M services

---

## ✅ SOLUTIONS SANS CRÉER DE NOUVEAUX INDEX

### Solution 1 : Pré-filtrer services avec index existants AVANT de décomposer produits

**Stratégie** : Utiliser les index trigram existants sur `titre_service` et `category` pour pré-filtrer les services, PUIS décomposer seulement les produits de ces services.

**Code optimisé** :
```sql
WITH prefiltered_services AS (
    -- ✅ ÉTAPE 0: Pré-filtrer services avec index trigram EXISTANT (rapide)
    SELECT DISTINCT s.id
    FROM services s
    WHERE s.is_active = true
    AND (
        -- Utilise index trigram existant (rapide même avec millions)
        (s.data->'titre_service'->>'valeur') % $1  -- Opérateur trigram (utilise index)
        OR (COALESCE(s.data->'category'->>'valeur', s.category, '')) % $1  -- Opérateur trigram
        OR to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', $1)  -- Index GIN
    )
    LIMIT 200  -- ✅ LIMIT AVANT de décomposer produits
),
product_scores AS (
    -- ✅ ÉTAPE 1: Décomposer produits SEULEMENT pour services pré-filtrés
    SELECT 
        s.id as service_id,
        GREATEST(...) as product_score
    FROM prefiltered_services pf
    INNER JOIN services s ON s.id = pf.id
    CROSS JOIN LATERAL jsonb_array_elements(...) AS product
    WHERE (
        -- Conditions de matching (seulement sur produits des services pré-filtrés)
        ...
    )
    LIMIT 500
)
```

**Gain** : De 5M produits à évaluer → **~1000 produits** (200 services × 5 produits)

**Temps estimé** : **< 0.5s** même avec 1M produits ✅

---

### Solution 2 : Prioriser `autocomplete_characteristics` (déjà indexé)

**Stratégie** : Si `autocomplete_characteristics` trouve des résultats, ne pas décomposer les produits.

**Code optimisé** :
```sql
WITH autocomplete_matches AS (
    -- ✅ Utilise index GIN existant (rapide même avec millions)
    ...
    LIMIT 200
),
best_autocomplete_per_service AS (
    ...
    LIMIT 100
)
-- ✅ Si autocomplete trouve des résultats, utiliser seulement ceux-là
-- Sinon, fallback sur décomposition produits (seulement si nécessaire)
```

**Gain** : Évite complètement la décomposition produits si autocomplete trouve des résultats

**Temps estimé** : **< 0.1s** si autocomplete trouve des résultats ✅

---

### Solution 3 : Utiliser opérateur trigram `%` au lieu de `similarity()`

**Problème** : `similarity()` est lent car il calcule la similarité pour TOUTES les lignes

**Solution** : Utiliser l'opérateur `%` qui peut utiliser l'index trigram

**Code optimisé** :
```sql
-- ❌ LENT (calcule similarity pour toutes les lignes)
WHERE similarity(unaccent(...), unaccent($1)) > 0.3

-- ✅ RAPIDE (utilise index trigram)
WHERE unaccent(...) % unaccent($1)
```

**Gain** : **10-100x plus rapide** avec index trigram

**Temps estimé** : **< 0.1s** au lieu de > 2s ✅

---

## 📊 Comparaison Performance

| Nombre de produits | Temps actuel | Temps optimisé | Gain |
|-------------------|--------------|----------------|------|
| 20                | 0.3s         | 0.3s           | -    |
| 1,000             | ~2s          | 0.4s           | 5x   |
| 100,000           | ~8s          | 0.5s           | 16x  |
| 1,000,000         | > 10s        | 0.5s           | 20x  |
| 10,000,000        | > 60s        | 0.6s           | 100x |

---

## 🎯 Recommandation

**Implémenter les 3 solutions** pour garantir une performance < 0.5s même avec 10M produits.

