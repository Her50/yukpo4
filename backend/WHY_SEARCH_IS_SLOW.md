# 🐌 Pourquoi la Recherche est Lente (Même dans la BD)

## ❌ Problèmes Identifiés dans la Requête SQL

### 1. **Recherches `ILIKE '%...%'` - SCAN COMPLET** ⚠️ CRITIQUE

```sql
-- ❌ PROBLÈME : Ces conditions ne peuvent PAS utiliser d'index
WHERE extract_all_product_text(product) ILIKE '%' || $1 || '%'
   OR product->>'nom' ILIKE '%' || $1 || '%'
   OR product->>'description' ILIKE '%' || $1 || '%'
```

**Pourquoi c'est lent ?**
- `ILIKE '%texte%'` (avec `%` au début) = **SCAN COMPLET** de toutes les lignes
- PostgreSQL ne peut pas utiliser d'index pour `%texte%` (seulement pour `texte%`)
- Pour 10,000 services actifs → **10,000 scans complets** !

**Impact** : **~500-1000ms** juste pour cette partie

---

### 2. **Calculs Complexes sur Chaque Ligne** ⚠️ CRITIQUE

```sql
-- ❌ PROBLÈME : Calculé pour CHAQUE produit de CHAQUE service
ts_rank(to_tsvector('french', extract_all_product_text(product)), plainto_tsquery('french', $1)) * 10.0 +
word_similarity(LOWER($1), LOWER(extract_all_product_text(product))) * 8.0 +
extract_all_product_text(product) -- Fonction récursive sur JSONB
```

**Pourquoi c'est lent ?**
- `extract_all_product_text()` = fonction récursive qui parse TOUT le JSONB
- `word_similarity()` = calcul trigram sur chaque texte (très coûteux)
- `ts_rank()` = création de tsvector + calcul de rank
- **Pour 100 produits × 10 services = 1000 calculs** !

**Impact** : **~300-500ms** juste pour les calculs de scores

---

### 3. **unnest() sur Arrays Sans Index Efficace** ⚠️ IMPORTANT

```sql
-- ❌ PROBLÈME : unnest() force un scan de TOUS les éléments
SELECT 1 FROM unnest(ac.full_vector) AS vec_val
WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
```

**Pourquoi c'est lent ?**
- `unnest()` crée une ligne par élément du array
- Pour 1000 services × 50 éléments/array = **50,000 lignes temporaires**
- Puis filtre avec `LIKE '%...%'` (scan complet)

**Impact** : **~200-400ms** pour cette partie

---

### 4. **Pas de LIMIT dans les CTEs Intermédiaires** ⚠️ IMPORTANT

```sql
-- ❌ PROBLÈME : Calcule sur TOUS les services actifs
WITH all_products_extracted AS (
    SELECT ... FROM services s WHERE s.is_active = true
    -- ❌ PAS DE LIMIT - Traite TOUS les services !
),
products_extracted AS (
    SELECT DISTINCT ... FROM all_products_extracted ape
    -- ❌ PAS DE LIMIT - Filtre TOUS les services !
)
```

**Pourquoi c'est lent ?**
- Si vous avez 10,000 services actifs → traite **TOUS** les 10,000
- Même si vous voulez seulement 100 résultats finaux
- **Solution** : Ajouter `LIMIT 1000` dans les CTEs intermédiaires

**Impact** : **~300-500ms** de traitement inutile

---

### 5. **4 CTEs Imbriqués avec JOINs** ⚠️ MOYEN

```sql
WITH all_products_extracted AS (...),
     products_extracted AS (...),
     products_scored AS (...),
     autocomplete_scored AS (...)
SELECT ... FROM products_extracted pe
LEFT JOIN products_scored ps ON ...
LEFT JOIN autocomplete_scored acs ON ...
```

**Pourquoi c'est lent ?**
- Chaque CTE crée une table temporaire
- Les JOINs entre CTEs peuvent être coûteux
- PostgreSQL doit optimiser 4 CTEs + 2 JOINs

**Impact** : **~100-200ms** pour l'optimisation et les JOINs

---

## 📊 Temps Total Estimé

| Composant | Temps | % |
|-----------|-------|---|
| ILIKE '%...%' scans | 500-1000ms | **50%** |
| Calculs scores (word_similarity, ts_rank) | 300-500ms | **30%** |
| unnest() arrays | 200-400ms | **15%** |
| CTEs + JOINs | 100-200ms | **5%** |
| **TOTAL** | **1100-2100ms** | **100%** |

---

## ✅ Solutions Proposées

### Solution 1 : Utiliser Full-Text Search au lieu de ILIKE (Gain : 70%)

```sql
-- ✅ AVANT (lent - scan complet)
WHERE product->>'nom' ILIKE '%' || $1 || '%'

-- ✅ APRÈS (rapide - utilise index GIN)
WHERE to_tsvector('french', product->>'nom') @@ plainto_tsquery('french', $1)
```

**Gain attendu** : **500-800ms → 50-100ms** (10x plus rapide)

---

### Solution 2 : Ajouter LIMIT dans les CTEs (Gain : 30%)

```sql
-- ✅ AVANT (traite tous les services)
WITH all_products_extracted AS (
    SELECT ... FROM services WHERE is_active = true
)

-- ✅ APRÈS (traite seulement les 1000 premiers)
WITH all_products_extracted AS (
    SELECT ... FROM services WHERE is_active = true LIMIT 1000
)
```

**Gain attendu** : **300-500ms → 30-50ms** (10x moins de données)

---

### Solution 3 : Index GIN sur full_vector (Gain : 15%)

```sql
-- ✅ Créer index GIN pour recherche dans arrays
CREATE INDEX idx_autocomplete_full_vector_gin_search 
ON autocomplete_characteristics 
USING GIN (full_vector gin_trgm_ops);
```

**Gain attendu** : **200-400ms → 50-100ms** (4x plus rapide)

---

### Solution 4 : Cache les résultats de extract_all_product_text() (Gain : 20%)

```sql
-- ✅ Créer colonne calculée avec index
ALTER TABLE services 
ADD COLUMN products_text_cache TEXT;

CREATE INDEX idx_services_products_text_cache_gin 
ON services USING GIN (to_tsvector('french', products_text_cache));
```

**Gain attendu** : **200-300ms → 20-30ms** (10x plus rapide)

---

## 🎯 Plan d'Action Prioritaire

### Phase 1 : Corrections Immédiates (Gain : 50%)
1. ✅ Remplacer `ILIKE '%...%'` par `@@ plainto_tsquery()` (full-text search)
2. ✅ Ajouter `LIMIT 1000` dans les CTEs intermédiaires

### Phase 2 : Optimisations Index (Gain : 30%)
3. ✅ Créer index GIN trigram sur `full_vector`
4. ✅ Créer colonne cache `products_text_cache` avec index GIN

### Phase 3 : Optimisations Avancées (Gain : 20%)
5. ✅ Utiliser vue matérialisée pour recherches fréquentes
6. ✅ Cache Redis pour résultats de recherche

---

## 📈 Résultats Attendus

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Temps requête SQL | 1-2s | **0.2-0.4s** | **75-80%** |
| Scans complets | 10,000 | **1,000** | **90%** |
| Calculs scores | 1,000 | **100** | **90%** |
| Utilisation index | 0% | **80%** | **+80%** |

---

## 🔍 Pourquoi PostgreSQL ne peut pas utiliser d'index pour `ILIKE '%...%'` ?

**Explication technique** :
- Les index B-tree fonctionnent comme un dictionnaire : on cherche "plombier" → on va directement à la page "P"
- Mais avec `'%plombier%'`, PostgreSQL ne sait pas où chercher → doit scanner TOUTES les pages
- C'est comme chercher un mot dans un livre sans connaître la page → il faut lire tout le livre !

**Solution** : Utiliser full-text search (`@@`) qui crée un index GIN spécialisé pour la recherche de texte.







