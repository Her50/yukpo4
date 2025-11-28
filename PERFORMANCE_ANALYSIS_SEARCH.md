# Analyse de Performance - Recherche Lente

## 🔍 Problèmes Identifiés dans les Logs

### 1. **Requête SQL très lente (1.5 secondes) - PRIORITÉ HAUTE**
**Fichier**: `backend/src/services/similar_products_service.rs:853`
**Requête**: Utilise `CROSS JOIN LATERAL jsonb_array_elements` avec `similarity()`

```sql
SELECT DISTINCT s.id as service_id, ...
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(...) AS product_elem
WHERE product_elem->>'nom' ILIKE '%' || $3 || '%'
  OR product_elem->>'description' ILIKE '%' || $3 || '%'
ORDER BY similarity_score DESC
LIMIT $2
```

**Problèmes**:
- `CROSS JOIN LATERAL` déplie TOUS les produits de TOUS les services avant filtrage
- `ILIKE '%' || $3 || '%'` ne peut pas utiliser d'index (pattern matching avec wildcards des deux côtés)
- `similarity()` est coûteux sur de grandes tables
- Pas d'index sur `s.data->'produits'`

**Impact**: 1.572 secondes (dépasse le seuil d'alerte de 1s)

---

### 2. **Requête sur publicites (409ms) - PRIORITÉ MOYENNE**
**Fichier**: `backend/src/services/publicite_search_service.rs:21`
**Requête**:
```sql
SELECT id, produits_indexes, zone_geographique,
       ST_X(geo_publicitaire::geometry) as pub_lng,
       ST_Y(geo_publicitaire::geometry) as pub_lat,
       rayon_km
FROM publicites
WHERE status = 'active' AND date_fin > NOW()
```

**Problèmes**:
- Récupère TOUTES les publicités actives à chaque recherche
- Calcul de `ST_X` et `ST_Y` sur chaque ligne
- Pas de limite (peut retourner des milliers de lignes)

**Impact**: 409ms par recherche

---

### 3. **Requête keyword_search (796ms) - PRIORITÉ MOYENNE**
**Fichier**: `backend/src/services/native_search_service.rs:1830`
**Requête**: Utilise plusieurs `ILIKE '%' || $3 || '%'` avec `EXISTS` et `similarity()`

**Problèmes**:
- Multiple `ILIKE` avec wildcards des deux côtés (pas d'index possible)
- Sous-requête `EXISTS` avec `similarity()` sur `autocomplete_characteristics`
- Opérations `unnest()` et `array_agg()` dans la sous-requête

**Impact**: 796ms

---

### 4. **Requête trigram_search (95ms) - PRIORITÉ BASSE**
**Fichier**: `backend/src/services/native_search_service.rs:1576`
**Requête**: Utilise `similarity()` sur plusieurs champs JSONB

**Problèmes**:
- `similarity()` appelé 3 fois par ligne (titre, description, category)
- Accès JSONB `s.data->'titre_service'->>'valeur'` non indexé
- Sous-requête `EXISTS` avec `similarity()` sur `autocomplete_characteristics`

**Impact**: 95ms (acceptable mais peut être optimisé)

---

## 📊 Temps Total de Recherche

D'après les logs:
- **Temps total**: 16.7 secondes
- **Breakdown**:
  - Requête similar_products (fallback): ~1.5s
  - Requête publicites: ~0.4s
  - Requête keyword_search: ~0.8s
  - Requête trigram_search: ~0.1s
  - Enrichissement Google Places: ~? (parallélisé mais peut être lent)
  - Autres opérations: ~13.9s (non identifiées dans les logs)

---

## ✅ Solutions Proposées

### Solution 1: Optimiser la requête similar_products (CRITIQUE)

**Problème**: `CROSS JOIN LATERAL` déplie tous les produits avant filtrage

**Solution**:
1. **Créer un index GIN sur les produits**:
```sql
CREATE INDEX IF NOT EXISTS idx_services_produits_gin 
ON services USING GIN ((data->'produits'));
```

2. **Utiliser une sous-requête avec LIMIT précoce**:
```sql
SELECT DISTINCT s.id as service_id, ...
FROM (
    SELECT id, data, is_active
    FROM services
    WHERE is_active = TRUE
      AND id != $1
      AND (
          data->'produits' @> ANY(ARRAY[
              jsonb_build_object('nom', $3),
              jsonb_build_object('description', $3)
          ])
          OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(data->'produits') AS p
              WHERE p->>'nom' ILIKE '%' || $3 || '%'
                 OR p->>'description' ILIKE '%' || $3 || '%'
          )
      )
    LIMIT 100  -- Limiter tôt
) s
CROSS JOIN LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        THEN s.data->'produits'->'valeur'
        ELSE '[]'::jsonb
    END
) AS product_elem
WHERE (
    product_elem->>'nom' ILIKE '%' || $3 || '%'
    OR product_elem->>'description' ILIKE '%' || $3 || '%'
    OR product_elem->>'categorie_produit' = $4
)
ORDER BY similarity_score DESC
LIMIT $2
```

3. **Alternative: Utiliser pg_trgm avec index**:
```sql
-- Créer index trigram sur les champs produits
CREATE INDEX IF NOT EXISTS idx_services_produits_nom_trgm 
ON services USING GIN ((data->'produits'->0->>'nom') gin_trgm_ops);

-- Utiliser similarity() avec index
WHERE similarity(product_elem->>'nom', $3) > 0.3
```

---

### Solution 2: Optimiser la requête publicites

**Problème**: Récupère toutes les publicités actives à chaque recherche

**Solutions**:
1. **Mettre en cache Redis** (déjà tenté mais Redis indisponible):
   - Cache TTL: 5 minutes
   - Clé: `publicites:active`

2. **Limiter la requête**:
```sql
SELECT id, produits_indexes, zone_geographique,
       ST_X(geo_publicitaire::geometry) as pub_lng,
       ST_Y(geo_publicitaire::geometry) as pub_lat,
       rayon_km
FROM publicites
WHERE status = 'active' 
  AND date_fin > NOW()
  AND date_debut <= NOW()  -- Ajouter condition
ORDER BY date_debut DESC
LIMIT 1000  -- Limiter le nombre
```

3. **Créer un index composite**:
```sql
CREATE INDEX IF NOT EXISTS idx_publicites_active_dates 
ON publicites(status, date_fin, date_debut) 
WHERE status = 'active';
```

4. **Pré-calculer ST_X/ST_Y** (ajouter colonnes calculées):
```sql
ALTER TABLE publicites 
ADD COLUMN IF NOT EXISTS pub_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS pub_lat DOUBLE PRECISION;

-- Mettre à jour via trigger ou migration
UPDATE publicites 
SET pub_lng = ST_X(geo_publicitaire::geometry),
    pub_lat = ST_Y(geo_publicitaire::geometry)
WHERE geo_publicitaire IS NOT NULL;
```

---

### Solution 3: Optimiser keyword_search

**Problème**: Multiple `ILIKE` avec wildcards des deux côtés

**Solutions**:
1. **Utiliser pg_trgm avec index**:
```sql
-- Créer index trigram
CREATE INDEX IF NOT EXISTS idx_services_titre_trgm 
ON services USING GIN ((data->'titre_service'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_description_trgm 
ON services USING GIN ((data->'description'->>'valeur') gin_trgm_ops);

-- Utiliser similarity() au lieu de ILIKE
WHERE similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1) > 0.3
```

2. **Optimiser la sous-requête EXISTS**:
```sql
-- Créer index sur location_vector
CREATE INDEX IF NOT EXISTS idx_autocomplete_location_vector_gin 
ON autocomplete_characteristics USING GIN(location_vector);

-- Utiliser && (overlap) au lieu de similarity() quand possible
WHERE ac.location_vector && string_to_array(LOWER($3), ' ')
```

---

### Solution 4: Optimiser trigram_search

**Problème**: `similarity()` appelé 3 fois par ligne

**Solutions**:
1. **Créer index trigram sur les champs JSONB**:
```sql
CREATE INDEX IF NOT EXISTS idx_services_titre_trgm 
ON services USING GIN ((data->'titre_service'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_description_trgm 
ON services USING GIN ((data->'description'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_category_trgm 
ON services USING GIN ((data->'category'->>'valeur') gin_trgm_ops);
```

2. **Utiliser GREATEST() avec index**:
```sql
-- PostgreSQL peut utiliser les index pour chaque similarity()
SELECT GREATEST(
    similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1),
    similarity(COALESCE(s.data->'description'->>'valeur', ''), $1),
    similarity(COALESCE(s.data->'category'->>'valeur', ''), $1)
)::REAL as trigram_score
```

---

### Solution 5: Mise en cache globale

**Problème**: Recherches répétées sans cache

**Solutions**:
1. **Activer Redis** (actuellement indisponible):
   - Vérifier la configuration Redis
   - Cache les résultats de recherche avec TTL: 5 minutes
   - Clé: `search:{query_hash}:{gps_hash}`

2. **Cache en mémoire** (fallback si Redis indisponible):
   - Utiliser `lru-cache` ou `moka` en Rust
   - TTL: 5 minutes
   - Limite: 1000 entrées

---

## 🎯 Plan d'Action Prioritaire

### Phase 1: Corrections Critiques (Impact immédiat)
1. ✅ Optimiser la requête `similar_products` (1.5s → <200ms)
2. ✅ Mettre en cache la requête `publicites` (409ms → <50ms avec cache)
3. ✅ Créer les index trigram manquants

### Phase 2: Optimisations Moyennes (Impact significatif)
4. ✅ Optimiser `keyword_search` avec index trigram
5. ✅ Pré-calculer ST_X/ST_Y dans `publicites`
6. ✅ Limiter les requêtes avec LIMIT précoce

### Phase 3: Améliorations Long Terme
7. ✅ Activer Redis pour cache distribué
8. ✅ Monitoring des requêtes lentes avec alertes
9. ✅ Analyse EXPLAIN ANALYZE régulière

---

## 📝 Notes Techniques

### Extension pg_trgm requise
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Vérifier les index existants
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('services', 'publicites', 'autocomplete_characteristics');
```

### Analyser une requête lente
```sql
EXPLAIN ANALYZE 
SELECT ... -- votre requête
```

---

## 🔧 Commandes de Migration

Créer un fichier de migration SQL avec toutes les optimisations:
```sql
-- Migration: optimize_search_performance
BEGIN;

-- Extension pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index pour similar_products
CREATE INDEX IF NOT EXISTS idx_services_produits_gin 
ON services USING GIN ((data->'produits'));

-- Index trigram pour keyword_search
CREATE INDEX IF NOT EXISTS idx_services_titre_trgm 
ON services USING GIN ((data->'titre_service'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_description_trgm 
ON services USING GIN ((data->'description'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_category_trgm 
ON services USING GIN ((data->'category'->>'valeur') gin_trgm_ops);

-- Index pour publicites
CREATE INDEX IF NOT EXISTS idx_publicites_active_dates 
ON publicites(status, date_fin, date_debut) 
WHERE status = 'active';

-- Index pour autocomplete_characteristics
CREATE INDEX IF NOT EXISTS idx_autocomplete_location_vector_gin 
ON autocomplete_characteristics USING GIN(location_vector);

-- Colonnes pré-calculées pour publicites
ALTER TABLE publicites 
ADD COLUMN IF NOT EXISTS pub_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS pub_lat DOUBLE PRECISION;

-- Mettre à jour les valeurs
UPDATE publicites 
SET pub_lng = ST_X(geo_publicitaire::geometry),
    pub_lat = ST_Y(geo_publicitaire::geometry)
WHERE geo_publicitaire IS NOT NULL 
  AND (pub_lng IS NULL OR pub_lat IS NULL);

COMMIT;
```

