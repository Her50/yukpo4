# 🔍 Analyse des Problèmes de Performance - Recherche Mobile

**Date**: 2025-12-17  
**Endpoint**: `POST /api/search/direct`  
**Temps de réponse observé**: **5117 ms** (5.1 secondes) ⚠️

---

## 📊 Problèmes Identifiés

### 1. **Requête SQL Keyword Search - 947ms** 🔴 CRITIQUE

**Localisation**: `native_search_service.rs:745-773`

**Requête problématique**:
```sql
SELECT 
    s.id,
    s.data,
    ...
    (
        SELECT COALESCE(SUM(
            CASE 
                WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || word || '%' THEN 3.0
                WHEN s.data->'description'->>'valeur' ILIKE '%' || word || '%' THEN 2.0
                WHEN s.data->'category'->>'valeur' ILIKE '%' || word || '%' THEN 2.5
                ELSE 0.0
            END
        ), 0.0)
        FROM unnest(string_to_array($1, ' ')) AS word
    ) * 0.5
)::REAL as keyword_score
FROM services s
WHERE s.is_active = true
AND (conditions multiples avec ILIKE)
```

**Problèmes**:
- ❌ **Scan complet de la table `services`** : Pas d'index efficace pour `ILIKE` sur JSONB
- ❌ **Sous-requête corrélée** : Exécutée pour chaque ligne de `services`
- ❌ **`unnest(string_to_array())`** : Opération coûteuse répétée
- ❌ **`ILIKE '%...%'`** : Ne peut pas utiliser d'index (pattern commence par wildcard)

**Impact**: 947ms pour une seule requête

---

### 2. **Requête Fulltext avec CTE - 437ms** 🟡 MODÉRÉ

**Localisation**: `native_search_service.rs:306-410`

**Requête problématique**:
```sql
WITH matched_services AS (
    -- ÉTAPE 1: Recherche via autocomplete_characteristics
    SELECT DISTINCT s.id as service_id
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE ...
    AND (
        EXISTS (
            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
            WHERE LOWER(vec_val) LIKE '%' || LOWER($1) || '%'
        )
        OR EXISTS (...)
        OR to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', $1)
    )
    UNION
    -- ÉTAPE 2: Recherche via services
    SELECT DISTINCT s.id as service_id
    FROM services s
    WHERE ...
)
SELECT DISTINCT ON (s.id)
    s.id,
    s.data,
    ...
    (
        -- Sous-requêtes corrélées multiples
        (ts_rank(...) + ts_rank(...) + ts_rank(...)) +
        (SELECT COALESCE(SUM(...)) FROM autocomplete_characteristics ...) +
        (SELECT COALESCE(SUM(...)) FROM autocomplete_characteristics ...) +
        CASE ... END
    )::REAL as fulltext_score
FROM matched_services ms
INNER JOIN services s ON s.id = ms.service_id
```

**Problèmes**:
- ⚠️ **Sous-requêtes corrélées multiples** : 3 sous-requêtes exécutées pour chaque service
- ⚠️ **`LIKE '%...%'` sur arrays** : Ne peut pas utiliser d'index efficacement
- ⚠️ **`unnest()` répété** : Opération coûteuse dans les sous-requêtes

**Impact**: 437ms pour la requête principale

---

### 3. **Requête Autocomplete - 756-873ms** 🟡 MODÉRÉ

**Localisation**: `autocomplete_search_service.rs`

**Requête problématique**:
```sql
SELECT DISTINCT ON (s.id)
    ...
    (
        -- Score avec unnest et EXISTS
        (
            SELECT COUNT(*)::REAL * 20.0
            FROM unnest($1::TEXT[]) AS search_val
            WHERE EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) = LOWER(search_val)
            )
        ) +
        (
            SELECT COUNT(*)::REAL * 10.0
            FROM unnest($1::TEXT[]) AS search_val
            WHERE EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
            )
        ) +
        ...
    ) as relevance_score
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE ...
AND (
    EXISTS (
        SELECT 1 FROM unnest($1::TEXT[]) AS search_val
        WHERE EXISTS (
            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
            WHERE LOWER(vec_val) LIKE '%' || LOWER(search_val) || '%'
        )
    )
    ...
)
```

**Problèmes**:
- ⚠️ **Double `unnest()` imbriqué** : Très coûteux
- ⚠️ **`LIKE '%...%'` sur arrays** : Pas d'index efficace
- ⚠️ **Sous-requêtes corrélées** : Exécutées pour chaque ligne

**Impact**: 756-873ms par requête autocomplete

---

### 4. **Requête Delivery Status Events - 1.2s** 🔴 CRITIQUE

**Localisation**: Logs montrent une requête sur `delivery_status_events`

**Requête problématique**:
```sql
SELECT
    id,
    delivery_id,
    status,
    occurred_at,
    COALESCE(payload, '{}'::jsonb) AS payload,
    recorded_by
FROM delivery_status_events
WHERE delivery_id = $1
ORDER BY occurred_at ASC
LIMIT $2
```

**Problèmes**:
- ❌ **Pas d'index sur `delivery_id`** : Probable scan complet
- ❌ **Pas d'index sur `occurred_at`** : Tri coûteux

**Impact**: 1.2 secondes pour une requête simple

---

### 5. **Requête Trigram Search - 398ms** 🟡 MODÉRÉ

**Localisation**: `native_search_service.rs:547-571`

**Requête problématique**:
```sql
SELECT DISTINCT
    s.id,
    s.data,
    ...
    GREATEST(
        similarity(COALESCE(s.data->'titre_service'->>'valeur', ''), $1),
        similarity(COALESCE(s.data->'description'->>'valeur', ''), $1),
        similarity(COALESCE(s.data->'category'->>'valeur', ''), $1)
    )::REAL as trigram_score
FROM services s
WHERE s.is_active = true
AND (
    similarity(...) > 0.1
    OR similarity(...) > 0.1
    OR similarity(...) > 0.1
)
```

**Problèmes**:
- ⚠️ **Fonction `similarity()` sur JSONB** : Ne peut pas utiliser d'index trigram directement
- ⚠️ **Scan complet** : Évalue `similarity()` pour tous les services actifs

**Impact**: 398ms

---

## 🎯 Solutions Recommandées

### **Solution 1: Index GIN sur JSONB pour Full-Text Search** ⚡ PRIORITÉ HAUTE

**Créer des index GIN sur les champs JSONB fréquemment recherchés**:

```sql
-- Index GIN pour recherche full-text sur titre_service
CREATE INDEX CONCURRENTLY idx_services_titre_service_gin 
ON services USING GIN (
    to_tsvector('french', COALESCE(data->'titre_service'->>'valeur', ''))
);

-- Index GIN pour recherche full-text sur description
CREATE INDEX CONCURRENTLY idx_services_description_gin 
ON services USING GIN (
    to_tsvector('french', COALESCE(data->'description'->>'valeur', ''))
);

-- Index GIN pour recherche full-text sur category
CREATE INDEX CONCURRENTLY idx_services_category_gin 
ON services USING GIN (
    to_tsvector('french', COALESCE(data->'category'->>'valeur', ''))
);

-- Index composite pour recherche combinée
CREATE INDEX CONCURRENTLY idx_services_fulltext_combined_gin 
ON services USING GIN (
    to_tsvector('french', 
        COALESCE(data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(data->'description'->>'valeur', '') || ' ' ||
        COALESCE(data->'category'->>'valeur', '')
    )
) WHERE is_active = true;
```

**Gain estimé**: 60-70% de réduction (947ms → ~300ms)

---

### **Solution 2: Index sur autocomplete_characteristics.full_vector** ⚡ PRIORITÉ HAUTE

**Créer un index GIN sur le tableau full_vector**:

```sql
-- Index GIN sur full_vector pour recherche rapide
CREATE INDEX CONCURRENTLY idx_autocomplete_full_vector_gin 
ON autocomplete_characteristics USING GIN (full_vector);

-- Index GIN sur characteristic_vector
CREATE INDEX CONCURRENTLY idx_autocomplete_characteristic_vector_gin 
ON autocomplete_characteristics USING GIN (characteristic_vector);

-- Index composite pour filtres fréquents
CREATE INDEX CONCURRENTLY idx_autocomplete_product_search 
ON autocomplete_characteristics (
    identifiant_base, 
    is_real_product
) 
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
```

**Gain estimé**: 50-60% de réduction (756ms → ~300ms)

---

### **Solution 3: Optimiser la requête Keyword Search** ⚡ PRIORITÉ HAUTE

**Remplacer la sous-requête corrélée par une jointure**:

```sql
-- AVANT (lent - 947ms)
SELECT 
    s.id,
    s.data,
    (
        SELECT COALESCE(SUM(...))
        FROM unnest(string_to_array($1, ' ')) AS word
    ) * 0.5 as keyword_score
FROM services s
WHERE ...

-- APRÈS (optimisé)
WITH search_words AS (
    SELECT unnest(string_to_array($1, ' ')) AS word
),
service_matches AS (
    SELECT 
        s.id,
        s.data,
        SUM(
            CASE 
                WHEN s.data->'titre_service'->>'valeur' ILIKE '%' || sw.word || '%' THEN 3.0
                WHEN s.data->'description'->>'valeur' ILIKE '%' || sw.word || '%' THEN 2.0
                WHEN s.data->'category'->>'valeur' ILIKE '%' || sw.word || '%' THEN 2.5
                ELSE 0.0
            END
        ) * 0.5 as keyword_score
    FROM services s
    CROSS JOIN search_words sw
    WHERE s.is_active = true
    AND (
        s.data->'titre_service'->>'valeur' ILIKE '%' || sw.word || '%'
        OR s.data->'description'->>'valeur' ILIKE '%' || sw.word || '%'
        OR s.data->'category'->>'valeur' ILIKE '%' || sw.word || '%'
    )
    GROUP BY s.id, s.data
)
SELECT * FROM service_matches
ORDER BY keyword_score DESC
LIMIT 100;
```

**Gain estimé**: 40-50% de réduction (947ms → ~500ms)

---

### **Solution 4: Index sur delivery_status_events** ⚡ PRIORITÉ MOYENNE

```sql
-- Index composite pour requêtes fréquentes
CREATE INDEX CONCURRENTLY idx_delivery_status_events_delivery_occurred 
ON delivery_status_events (delivery_id, occurred_at);

-- Index sur delivery_id seul (si pas déjà présent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_status_events_delivery_id 
ON delivery_status_events (delivery_id);
```

**Gain estimé**: 80-90% de réduction (1.2s → ~150ms)

---

### **Solution 5: Materialized View pour Recherche** ⚡ PRIORITÉ MOYENNE

**Créer une vue matérialisée pour les recherches fréquentes**:

```sql
-- Vue matérialisée pour recherche rapide
CREATE MATERIALIZED VIEW services_search_cache AS
SELECT 
    s.id,
    s.data,
    s.created_at,
    s.user_id,
    s.gps,
    s.category,
    s.is_active,
    -- Pré-calculer les tsvector
    to_tsvector('french', 
        COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
        COALESCE(s.data->'category'->>'valeur', '')
    ) as search_vector,
    -- Extraire les produits pour recherche rapide
    (
        SELECT array_agg(DISTINCT value::text)
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        ) AS value
    ) as product_names
FROM services s
WHERE s.is_active = true;

-- Index GIN sur la vue matérialisée
CREATE INDEX idx_services_search_cache_vector_gin 
ON services_search_cache USING GIN (search_vector);

-- Index GIN sur product_names
CREATE INDEX idx_services_search_cache_products_gin 
ON services_search_cache USING GIN (product_names);

-- Rafraîchir périodiquement (via cron)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_cache;
```

**Gain estimé**: 70-80% de réduction sur les recherches répétées

---

### **Solution 6: Cache Redis pour Résultats de Recherche** ⚡ PRIORITÉ MOYENNE

**Implémenter un cache Redis pour les recherches fréquentes**:

```rust
// Dans native_search_service.rs
async fn search_with_cache(
    &self,
    query: &str,
    gps_zone: Option<&str>,
    search_radius_km: Option<i32>,
) -> AppResult<Vec<SearchResult>> {
    // Générer une clé de cache
    let cache_key = format!(
        "search:{}:{}:{}",
        query,
        gps_zone.unwrap_or("none"),
        search_radius_km.unwrap_or(50)
    );
    
    // Vérifier le cache
    if let Some(cached) = self.cache_service.get(&cache_key).await? {
        return Ok(cached);
    }
    
    // Exécuter la recherche
    let results = self.search(query, gps_zone, search_radius_km).await?;
    
    // Mettre en cache (TTL: 5 minutes)
    self.cache_service.set(&cache_key, &results, 300).await?;
    
    Ok(results)
}
```

**Gain estimé**: 95%+ de réduction pour recherches répétées (5s → <50ms)

---

## 📈 Impact Global Estimé

| Solution | Gain Estimé | Priorité | Effort |
|----------|-------------|----------|--------|
| Index GIN JSONB | 60-70% | 🔴 HAUTE | Faible |
| Index autocomplete_characteristics | 50-60% | 🔴 HAUTE | Faible |
| Optimisation requête keyword | 40-50% | 🔴 HAUTE | Moyen |
| Index delivery_status_events | 80-90% | 🟡 MOYENNE | Faible |
| Materialized View | 70-80% | 🟡 MOYENNE | Moyen |
| Cache Redis | 95%+ | 🟡 MOYENNE | Élevé |

**Temps de réponse cible après optimisations**: **< 500ms** (au lieu de 5117ms)

---

## 🚀 Plan d'Implémentation

### **Phase 1: Quick Wins (1-2 jours)**
1. ✅ Créer les index GIN sur JSONB
2. ✅ Créer les index sur autocomplete_characteristics
3. ✅ Créer les index sur delivery_status_events

**Gain attendu**: 60-70% de réduction (5117ms → ~1500ms)

### **Phase 2: Optimisations Requêtes (2-3 jours)**
1. ✅ Optimiser la requête keyword_search
2. ✅ Réduire les sous-requêtes corrélées
3. ✅ Utiliser des CTE au lieu de sous-requêtes

**Gain attendu**: 40-50% supplémentaire (1500ms → ~750ms)

### **Phase 3: Cache et Vues Matérialisées (3-5 jours)**
1. ✅ Implémenter cache Redis
2. ✅ Créer materialized view
3. ✅ Automatiser le rafraîchissement

**Gain attendu**: 70-80% supplémentaire (750ms → <200ms)

---

## 🔍 Monitoring

**Métriques à surveiller**:
- Temps de réponse moyen `/api/search/direct`
- Temps d'exécution des requêtes SQL individuelles
- Taux de cache hit/miss
- Nombre de requêtes lentes (>1s)

**Alertes à configurer**:
- ⚠️ Requête > 2s : Warning
- 🚨 Requête > 5s : Error
- 📊 Requête SQL > 500ms : Warning

---

## 📝 Notes Techniques

### **Pourquoi `ILIKE '%...%'` est lent ?**
- Les patterns qui commencent par `%` ne peuvent pas utiliser d'index B-tree
- PostgreSQL doit scanner toutes les lignes
- Solution: Utiliser `to_tsvector` + `plainto_tsquery` avec index GIN

### **Pourquoi les sous-requêtes corrélées sont lentes ?**
- Exécutées une fois par ligne de la requête principale
- Pas de possibilité d'optimisation par le planificateur
- Solution: Utiliser des CTE ou des jointures

### **Pourquoi `unnest()` est coûteux ?**
- Crée une nouvelle ligne pour chaque élément du tableau
- Si répété dans une sous-requête, multiplie les opérations
- Solution: Utiliser des CTE pour calculer une seule fois

---

## ✅ Checklist d'Implémentation

- [ ] Créer les index GIN sur services.data
- [ ] Créer les index sur autocomplete_characteristics
- [ ] Créer les index sur delivery_status_events
- [ ] Optimiser la requête keyword_search
- [ ] Réduire les sous-requêtes corrélées
- [ ] Implémenter cache Redis
- [ ] Créer materialized view
- [ ] Configurer le rafraîchissement automatique
- [ ] Ajouter des métriques de performance
- [ ] Tester les performances après chaque phase

---

**Auteur**: Analyse automatique basée sur les logs  
**Date**: 2025-12-17  
**Version**: 1.0





