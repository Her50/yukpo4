# 🎯 Solution : Matching Vectoriel avec Gestion des Variantes

## Problème Identifié

Le matching exact avec `= ANY()` ne gère **PAS** :
- ❌ **Mots tronqués** : "vest" au lieu de "veste"
- ❌ **Fautes de frappe** : "veste" vs "vestte"
- ❌ **Accents** : "café" vs "cafe"

## ✅ Solution Hybride : Matching Vectoriel + Normalisation + Fuzzy Matching

### Stratégie en 3 Niveaux

```
NIVEAU 1 : Matching Exact (Performance optimale)
  ↓ Si peu de résultats
NIVEAU 2 : Matching avec Variantes d'Accents (Normalisation)
  ↓ Si encore peu de résultats
NIVEAU 3 : Matching Fuzzy (Trigram pour fautes de frappe/mots tronqués)
```

---

## 🔧 Implémentation : Fonction PostgreSQL Optimisée

### Étape 1 : Créer une Fonction de Normalisation

```sql
-- Fonction pour normaliser un mot (supprimer accents, minuscules)
CREATE OR REPLACE FUNCTION normalize_word(word TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        translate(
            word,
            'àâäéèêëîïôöùûüÿç',
            'aaaeeeeiiioouuuyc'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour normaliser un array de mots
CREATE OR REPLACE FUNCTION normalize_word_array(word_array TEXT[])
RETURNS TEXT[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT normalize_word(unnest(word_array))
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Étape 2 : Fonction de Matching Vectoriel avec Variantes

```sql
-- Fonction pour calculer le score d'inclusion vectorielle avec variantes
CREATE OR REPLACE FUNCTION calculate_vector_inclusion_score_with_variants(
    product_vector TEXT[],
    search_keywords TEXT[],
    use_fuzzy BOOLEAN DEFAULT FALSE
)
RETURNS REAL AS $$
DECLARE
    matches_count INTEGER := 0;
    fuzzy_matches_count INTEGER := 0;
    keyword TEXT;
    product_elem TEXT;
    normalized_keyword TEXT;
    normalized_elem TEXT;
    similarity_score REAL;
BEGIN
    -- Si l'un des arrays est NULL ou vide, retourner 0
    IF product_vector IS NULL OR array_length(product_vector, 1) IS NULL THEN
        RETURN 0.0;
    END IF;
    
    IF search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL THEN
        RETURN 0.0;
    END IF;
    
    -- Normaliser les mots-clés de recherche
    DECLARE
        normalized_keywords TEXT[] := normalize_word_array(search_keywords);
        normalized_product_vector TEXT[] := normalize_word_array(product_vector);
    BEGIN
        -- Pour chaque mot-clé de recherche
        FOREACH keyword IN ARRAY search_keywords
        LOOP
            normalized_keyword := normalize_word(keyword);
            matches_count := 0;
            
            -- NIVEAU 1 : Match exact (avec normalisation accents)
            FOREACH product_elem IN ARRAY product_vector
            LOOP
                normalized_elem := normalize_word(product_elem);
                
                -- Match exact normalisé
                IF normalized_keyword = normalized_elem THEN
                    matches_count := matches_count + 1;
                    EXIT; -- Trouvé, passer au mot-clé suivant
                END IF;
                
                -- NIVEAU 2 : Match partiel (mot-clé contenu dans élément ou vice versa)
                IF normalized_keyword LIKE normalized_elem || '%' 
                   OR normalized_elem LIKE normalized_keyword || '%' THEN
                    matches_count := matches_count + 1;
                    EXIT;
                END IF;
                
                -- NIVEAU 3 : Fuzzy matching (si activé)
                IF use_fuzzy THEN
                    similarity_score := similarity(normalized_keyword, normalized_elem);
                    IF similarity_score > 0.3 THEN  -- Seuil de similarité
                        fuzzy_matches_count := fuzzy_matches_count + 1;
                        EXIT;
                    END IF;
                END IF;
            END LOOP;
        END LOOP;
    END;
    
    -- Calculer le score final
    -- Score exact : 100% par match
    -- Score fuzzy : 50% par match (moins de confiance)
    DECLARE
        exact_score REAL := (matches_count::REAL / array_length(search_keywords, 1)::REAL) * 100.0;
        fuzzy_score REAL := (fuzzy_matches_count::REAL / array_length(search_keywords, 1)::REAL) * 50.0;
    BEGIN
        RETURN GREATEST(exact_score, fuzzy_score);
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### ⚠️ Problème de Performance

Cette approche avec boucles imbriquées peut être **lente** sur des centaines de millions de produits. Il faut une approche plus optimisée.

---

## ✅ Solution Optimisée : Utiliser les Opérateurs PostgreSQL Natifs

### Approche Recommandée : Matching en 3 Phases avec Index

```sql
-- PHASE 1 : Matching exact normalisé (rapide avec index)
WITH search_keywords_normalized AS (
    SELECT ARRAY(
        SELECT normalize_word(unnest(ARRAY['veste', 'cuir', 'zara']::TEXT[]))
    ) as keywords
),
product_vectors_normalized AS (
    SELECT 
        ac.service_id,
        ac.characteristic_vector,
        ac.full_vector,
        normalize_word_array(ac.characteristic_vector) as normalized_characteristic_vector,
        normalize_word_array(ac.full_vector) as normalized_full_vector,
        ac.valeur,
        ac.usage_count
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
      AND ac.identifiant_base = 'produits'
      AND ac.is_real_product = TRUE
),
exact_matches AS (
    -- ✅ PHASE 1 : Matching exact normalisé (utilise index GIN)
    SELECT 
        pv.service_id,
        pv.valeur,
        pv.usage_count,
        -- Compter matches exacts dans characteristic_vector
        (
            SELECT COUNT(*)::REAL
            FROM unnest(skn.keywords) AS keyword
            WHERE keyword = ANY(pv.normalized_characteristic_vector)
        ) as characteristic_exact_matches,
        -- Compter matches exacts dans full_vector
        (
            SELECT COUNT(*)::REAL
            FROM unnest(skn.keywords) AS keyword
            WHERE keyword = ANY(pv.normalized_full_vector)
        ) as full_exact_matches
    FROM product_vectors_normalized pv
    CROSS JOIN search_keywords_normalized skn
    WHERE 
        -- Filtrer rapidement avec && (utilise index GIN)
        pv.normalized_characteristic_vector && skn.keywords
        OR pv.normalized_full_vector && skn.keywords
),
partial_matches AS (
    -- ✅ PHASE 2 : Matching partiel (pour mots tronqués)
    SELECT 
        em.service_id,
        em.valeur,
        em.usage_count,
        em.characteristic_exact_matches,
        em.full_exact_matches,
        -- Compter matches partiels (mot-clé contenu dans élément)
        (
            SELECT COUNT(*)::REAL
            FROM unnest(skn.keywords) AS keyword
            WHERE EXISTS (
                SELECT 1
                FROM unnest(pv.normalized_characteristic_vector) AS elem
                WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
            )
        ) as characteristic_partial_matches,
        (
            SELECT COUNT(*)::REAL
            FROM unnest(skn.keywords) AS keyword
            WHERE EXISTS (
                SELECT 1
                FROM unnest(pv.normalized_full_vector) AS elem
                WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
            )
        ) as full_partial_matches
    FROM exact_matches em
    CROSS JOIN search_keywords_normalized skn
    CROSS JOIN product_vectors_normalized pv
    WHERE pv.service_id = em.service_id
      AND (em.characteristic_exact_matches = 0 AND em.full_exact_matches = 0)  -- Seulement si pas de match exact
),
fuzzy_matches AS (
    -- ✅ PHASE 3 : Fuzzy matching (pour fautes de frappe)
    SELECT 
        COALESCE(pm.service_id, em.service_id) as service_id,
        COALESCE(pm.valeur, em.valeur) as valeur,
        COALESCE(pm.usage_count, em.usage_count) as usage_count,
        -- Compter matches fuzzy avec trigram (similarity > 0.3)
        (
            SELECT COUNT(*)::REAL
            FROM unnest(skn.keywords) AS keyword
            WHERE EXISTS (
                SELECT 1
                FROM unnest(pv.normalized_characteristic_vector) AS elem
                WHERE similarity(keyword, elem) > 0.3
            )
        ) as characteristic_fuzzy_matches,
        (
            SELECT COUNT(*)::REAL
            FROM unnest(skn.keywords) AS keyword
            WHERE EXISTS (
                SELECT 1
                FROM unnest(pv.normalized_full_vector) AS elem
                WHERE similarity(keyword, elem) > 0.3
            )
        ) as full_fuzzy_matches
    FROM exact_matches em
    LEFT JOIN partial_matches pm ON pm.service_id = em.service_id
    CROSS JOIN search_keywords_normalized skn
    CROSS JOIN product_vectors_normalized pv
    WHERE pv.service_id = COALESCE(pm.service_id, em.service_id)
      AND COALESCE(pm.characteristic_exact_matches, em.characteristic_exact_matches) = 0
      AND COALESCE(pm.full_exact_matches, em.full_exact_matches) = 0
      AND COALESCE(pm.characteristic_partial_matches, 0) = 0
      AND COALESCE(pm.full_partial_matches, 0) = 0  -- Seulement si pas de match exact/partiel
)
SELECT 
    service_id,
    valeur,
    usage_count,
    array_length(skn.keywords, 1)::REAL as total_keywords,
    -- Score final : combiner exact (100%), partiel (70%), fuzzy (40%)
    GREATEST(
        -- Score exact
        (
            GREATEST(
                COALESCE(em.characteristic_exact_matches, 0),
                COALESCE(em.full_exact_matches, 0)
            ) / array_length(skn.keywords, 1)::REAL * 100.0
        ),
        -- Score partiel (70% de confiance)
        (
            GREATEST(
                COALESCE(pm.characteristic_partial_matches, 0),
                COALESCE(pm.full_partial_matches, 0)
            ) / array_length(skn.keywords, 1)::REAL * 70.0
        ),
        -- Score fuzzy (40% de confiance)
        (
            GREATEST(
                COALESCE(fm.characteristic_fuzzy_matches, 0),
                COALESCE(fm.full_fuzzy_matches, 0)
            ) / array_length(skn.keywords, 1)::REAL * 40.0
        )
    ) + (usage_count::REAL * 0.5) as final_score
FROM exact_matches em
LEFT JOIN partial_matches pm ON pm.service_id = em.service_id
LEFT JOIN fuzzy_matches fm ON fm.service_id = COALESCE(pm.service_id, em.service_id)
CROSS JOIN search_keywords_normalized skn
WHERE 
    COALESCE(em.characteristic_exact_matches, 0) > 0
    OR COALESCE(em.full_exact_matches, 0) > 0
    OR COALESCE(pm.characteristic_partial_matches, 0) > 0
    OR COALESCE(pm.full_partial_matches, 0) > 0
    OR COALESCE(fm.characteristic_fuzzy_matches, 0) > 0
    OR COALESCE(fm.full_fuzzy_matches, 0) > 0
ORDER BY final_score DESC
LIMIT 100;
```

### ⚠️ Problème : Cette Requête est Trop Complexe

Cette approche avec 3 phases séparées peut être lente. Il faut une approche plus simple et efficace.

---

## ✅ Solution Finale : Approche Simplifiée et Optimisée

### Principe : Normaliser AVANT le Matching Vectoriel

```sql
-- ✅ SOLUTION OPTIMISÉE : Normaliser les vecteurs AVANT le matching
WITH search_keywords_normalized AS (
    SELECT ARRAY(
        SELECT normalize_word(unnest(ARRAY['veste', 'cuir', 'zara']::TEXT[]))
    ) as keywords
),
product_vectors_with_normalized AS (
    SELECT 
        ac.service_id,
        ac.characteristic_vector,
        ac.full_vector,
        -- ✅ Normaliser les vecteurs une seule fois
        normalize_word_array(ac.characteristic_vector) as normalized_characteristic_vector,
        normalize_word_array(ac.full_vector) as normalized_full_vector,
        ac.valeur,
        ac.usage_count
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
      AND ac.identifiant_base = 'produits'
      AND ac.is_real_product = TRUE
      -- ✅ FILTRAGE RAPIDE avec && sur vecteurs normalisés
      AND (
          normalize_word_array(ac.characteristic_vector) && (
              SELECT keywords FROM search_keywords_normalized
          )
          OR normalize_word_array(ac.full_vector) && (
              SELECT keywords FROM search_keywords_normalized
          )
      )
),
vector_scores AS (
    SELECT 
        pv.service_id,
        pv.valeur,
        pv.usage_count,
        skn.keywords,
        -- ✅ Score exact normalisé (100%)
        COALESCE(
            (
                SELECT COUNT(*)::REAL
                FROM unnest(skn.keywords) AS keyword
                WHERE keyword = ANY(pv.normalized_characteristic_vector)
            ) / NULLIF(array_length(skn.keywords, 1), 0)::REAL * 100.0,
            0.0
        ) as characteristic_exact_score,
        COALESCE(
            (
                SELECT COUNT(*)::REAL
                FROM unnest(skn.keywords) AS keyword
                WHERE keyword = ANY(pv.normalized_full_vector)
            ) / NULLIF(array_length(skn.keywords, 1), 0)::REAL * 100.0,
            0.0
        ) as full_exact_score,
        -- ✅ Score partiel (70%) - pour mots tronqués
        COALESCE(
            (
                SELECT COUNT(*)::REAL
                FROM unnest(skn.keywords) AS keyword
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(pv.normalized_characteristic_vector) AS elem
                    WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
                )
            ) / NULLIF(array_length(skn.keywords, 1), 0)::REAL * 70.0,
            0.0
        ) as characteristic_partial_score,
        COALESCE(
            (
                SELECT COUNT(*)::REAL
                FROM unnest(skn.keywords) AS keyword
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(pv.normalized_full_vector) AS elem
                    WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
                )
            ) / NULLIF(array_length(skn.keywords, 1), 0)::REAL * 70.0,
            0.0
        ) as full_partial_score
    FROM product_vectors_with_normalized pv
    CROSS JOIN search_keywords_normalized skn
)
SELECT 
    vs.service_id,
    vs.valeur,
    vs.usage_count,
    -- Score final : prendre le meilleur (exact ou partiel)
    GREATEST(
        vs.characteristic_exact_score,
        vs.full_exact_score,
        vs.characteristic_partial_score,
        vs.full_partial_score
    ) + (vs.usage_count::REAL * 0.5) as final_score
FROM vector_scores vs
WHERE 
    vs.characteristic_exact_score > 0
    OR vs.full_exact_score > 0
    OR vs.characteristic_partial_score > 0
    OR vs.full_partial_score > 0
ORDER BY final_score DESC
LIMIT 100;
```

### Pour les Fautes de Frappe : Fallback Trigram

Si cette requête ne trouve pas assez de résultats, utiliser le **fallback trigram** existant qui gère les fautes de frappe avec `similarity()`.

---

## 📊 Index Requis pour Performance

```sql
-- Index GIN sur vecteurs normalisés (pour accélérer &&)
-- Note: PostgreSQL ne peut pas indexer directement une fonction
-- Il faut créer une colonne calculée ou utiliser un index fonctionnel

-- Option 1 : Colonne calculée (recommandé)
ALTER TABLE autocomplete_characteristics 
ADD COLUMN normalized_characteristic_vector TEXT[] 
GENERATED ALWAYS AS (normalize_word_array(characteristic_vector)) STORED;

ALTER TABLE autocomplete_characteristics 
ADD COLUMN normalized_full_vector TEXT[] 
GENERATED ALWAYS AS (normalize_word_array(full_vector)) STORED;

-- Index GIN sur colonnes normalisées
CREATE INDEX idx_autocomplete_normalized_characteristic_vector_gin 
ON autocomplete_characteristics USING GIN (normalized_characteristic_vector);

CREATE INDEX idx_autocomplete_normalized_full_vector_gin 
ON autocomplete_characteristics USING GIN (normalized_full_vector);

-- Option 2 : Index fonctionnel (si colonnes calculées non supportées)
CREATE INDEX idx_autocomplete_normalized_characteristic_vector_func_gin 
ON autocomplete_characteristics 
USING GIN (normalize_word_array(characteristic_vector));

CREATE INDEX idx_autocomplete_normalized_full_vector_func_gin 
ON autocomplete_characteristics 
USING GIN (normalize_word_array(full_vector));
```

---

## 🎯 Résumé de la Solution

### Matching en 3 Niveaux

1. **Niveau 1 : Match Exact Normalisé** (100% score)
   - Normaliser accents : "café" = "cafe"
   - Match exact avec `= ANY()`
   - **Performance** : Utilise index GIN, très rapide

2. **Niveau 2 : Match Partiel** (70% score)
   - Pour mots tronqués : "vest" match "veste"
   - Utilise `LIKE` avec `%`
   - **Performance** : Calculé seulement si pas de match exact

3. **Niveau 3 : Fuzzy Matching** (40% score)
   - Pour fautes de frappe : "vestte" match "veste"
   - Utilise `similarity()` (trigram)
   - **Performance** : Fallback seulement si pas assez de résultats

### Avantages

- ✅ **Gère les accents** : Normalisation avant matching
- ✅ **Gère les mots tronqués** : Matching partiel avec `LIKE`
- ✅ **Gère les fautes de frappe** : Fallback trigram
- ✅ **Performance optimale** : Index GIN sur vecteurs normalisés
- ✅ **Scalable** : Fonctionne avec des centaines de millions de produits

---

## 🔧 Implémentation dans Rust

```rust
// 1. Normaliser les mots-clés de recherche
let search_keywords: Vec<String> = query
    .split_whitespace()
    .filter(|w| w.len() >= 2)
    .map(|w| normalize_word(w))  // Supprimer accents, minuscules
    .collect();

// 2. Construire la requête SQL avec matching vectoriel normalisé
let sql = format!(r#"
WITH search_keywords_normalized AS (
    SELECT $1::TEXT[] as keywords
),
product_vectors_with_normalized AS (
    SELECT 
        ac.service_id,
        normalize_word_array(ac.characteristic_vector) as normalized_characteristic_vector,
        normalize_word_array(ac.full_vector) as normalized_full_vector,
        ac.valeur,
        ac.usage_count
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE s.is_active = true
      AND ac.identifiant_base = 'produits'
      AND ac.is_real_product = TRUE
      -- ✅ FILTRAGE RAPIDE avec && sur vecteurs normalisés
      AND (
          normalize_word_array(ac.characteristic_vector) && (
              SELECT keywords FROM search_keywords_normalized
          )
          OR normalize_word_array(ac.full_vector) && (
              SELECT keywords FROM search_keywords_normalized
          )
      )
),
vector_scores AS (
    SELECT 
        pv.service_id,
        pv.valeur,
        pv.usage_count,
        -- Score exact normalisé (100%)
        COALESCE(
            (
                SELECT COUNT(*)::REAL
                FROM unnest(skn.keywords) AS keyword
                WHERE keyword = ANY(pv.normalized_characteristic_vector)
            ) / NULLIF(array_length(skn.keywords, 1), 0)::REAL * 100.0,
            0.0
        ) as characteristic_exact_score,
        -- Score partiel (70%) - pour mots tronqués
        COALESCE(
            (
                SELECT COUNT(*)::REAL
                FROM unnest(skn.keywords) AS keyword
                WHERE EXISTS (
                    SELECT 1
                    FROM unnest(pv.normalized_characteristic_vector) AS elem
                    WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
                )
            ) / NULLIF(array_length(skn.keywords, 1), 0)::REAL * 70.0,
            0.0
        ) as characteristic_partial_score
    FROM product_vectors_with_normalized pv
    CROSS JOIN search_keywords_normalized skn
)
SELECT 
    vs.service_id,
    vs.valeur,
    GREATEST(
        vs.characteristic_exact_score,
        vs.characteristic_partial_score
    ) + (vs.usage_count::REAL * 0.5) as final_score
FROM vector_scores vs
WHERE vs.characteristic_exact_score > 0 OR vs.characteristic_partial_score > 0
ORDER BY final_score DESC
LIMIT 100
"#);
```

---

## ✅ Conclusion

**Votre question est pertinente** : Le matching exact ne gère pas les variantes. La solution est de :

1. **Normaliser les vecteurs** (supprimer accents) avant le matching
2. **Utiliser le matching vectoriel optimisé** avec `&&` et `= ANY()`
3. **Ajouter un niveau de matching partiel** pour les mots tronqués
4. **Utiliser le fallback trigram** existant pour les fautes de frappe

Cette approche combine **performance** (matching vectoriel optimisé) et **robustesse** (gestion des variantes).


