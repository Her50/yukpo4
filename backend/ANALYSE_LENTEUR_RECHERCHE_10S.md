# 🔍 Analyse en profondeur : Lenteur recherche (>10s)

## 📊 Constat initial

D'après les logs :
- **Requête principale** : `POST /api/search/direct` → **8101ms** (8.1s) et **7747ms** (7.7s)
- **Requête SQL lente** : **4.46248377s** (4.46 secondes) - marquée comme "slow statement"
- **Requête trigram** : **788.972406ms** (0.79s)
- **Total** : ~8-10 secondes pour une recherche simple "chaussures"

## 🎯 Problème identifié : REQUÊTE SQL TROP COMPLEXE

### Requête problématique : `keyword_search_with_gps` (lignes 1112-1342)

**Localisation** : `backend/src/services/native_search_service.rs:1112-1342`

### 🔴 Problèmes critiques identifiés

#### 1. **14 PRIORITÉS DE SCORING avec CASE WHEN imbriqués** (lignes 1160-1293)
```sql
GREATEST(
    COALESCE(ac.ac_score, 0.0),
    CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(...)) THEN 100.0
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(...)) THEN 80.0
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(...)) THEN 70.0
    -- ... 11 autres priorités similaires
    END
)::REAL as keyword_score
```

**Impact** : PostgreSQL doit évaluer **14 conditions CASE WHEN** pour chaque service, et chaque condition contient un `EXISTS` avec `jsonb_array_elements`.

#### 2. **MULTIPLES `jsonb_array_elements` PAR SERVICE** (lignes 1166-1175, 1179-1189, etc.)

Chaque `jsonb_array_elements` :
- Décompose le tableau JSON en lignes
- Est exécuté **pour chaque service**
- Est répété **14 fois** (une fois par priorité)

**Exemple** :
```sql
EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS product
    WHERE LOWER(COALESCE(product->>'nom_produit', product->>'nom', '')) = LOWER($1)
)
```

**Impact** : Si un service a 5 produits, cette requête est exécutée **14 fois × 5 produits = 70 fois** pour ce service seul.

#### 3. **FULL-TEXT SEARCH RÉPÉTÉE** (lignes 1267-1290)

Chaque priorité exécute :
- `to_tsvector('french', ...)` 
- `plainto_tsquery('french', $1)`
- `ts_rank(...)`

**Impact** : Ces opérations sont coûteuses et répétées plusieurs fois pour le même texte.

#### 4. **LEFT JOIN avec CTE complexe** (ligne 1296)

```sql
LEFT JOIN best_autocomplete_per_service ac ON ac.service_id = s.id
```

La CTE `best_autocomplete_per_service` elle-même contient une CTE `autocomplete_matches` qui fait déjà beaucoup de calculs.

#### 5. **WHERE CLAUSE avec EXISTS multiples** (lignes 1299-1337)

La clause WHERE contient :
- Un `EXISTS` avec `jsonb_array_elements` (lignes 1304-1325)
- Plusieurs conditions `ILIKE` et `to_tsvector` (lignes 1327-1336)

**Impact** : Ces conditions sont évaluées **avant** le scoring, ce qui peut filtrer des résultats, mais elles sont aussi coûteuses.

## 🔍 Analyse de la séquence d'exécution

D'après les logs, voici ce qui se passe :

1. **04:29:07.695** : Début de la recherche "chaussures"
2. **04:29:07.700** : Requête vectorielle optimisée (12.4ms) - **RAPIDE** ✅
3. **04:29:07.713** : Fallback trigram déclenché (0 résultats)
4. **04:29:09.907** : **DÉBUT de la requête keyword_search_with_gps** (la lente)
5. **04:29:14.251** : **FIN de la requête** → **4.34 secondes** (4.462s dans les logs)

### Timeline détaillée

```
04:29:07.695 - [RECHERCHE_DIRECTE] Recherche directe
04:29:07.700 - Requête vectorielle optimisée (12.4ms) - 0 résultats
04:29:07.713 - Fallback trigram (0 résultats)
04:29:09.907 - ⚠️ DÉBUT keyword_search_with_gps (requête complexe)
04:29:14.251 - ⚠️ FIN keyword_search_with_gps (4.34s)
04:29:14.615 - Réponse complète (7.7s total)
```

## 💡 Solutions proposées

### Solution 1 : SIMPLIFIER LE SCORING (PRIORITÉ HAUTE)

**Problème** : 14 priorités avec `jsonb_array_elements` répétés

**Solution** : Pré-calculer les scores dans une CTE avant le SELECT final

```sql
WITH product_matches AS (
    -- ✅ UNE SEULE FOIS : Extraire et scorer les produits
    SELECT 
        s.id as service_id,
        product->>'nom_produit' as nom_produit,
        product->>'description_produit' as description_produit,
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
    FROM product_matches
    GROUP BY service_id
)
-- Ensuite utiliser max_product_score dans le SELECT final
```

**Gain estimé** : **-3.5s** (de 4.46s à ~1s)

### Solution 2 : UTILISER LES INDEX GIN EXISTANTS

**Problème** : Les `to_tsvector` et `plainto_tsquery` sont recalculés à chaque fois

**Solution** : Utiliser les colonnes tsvector pré-calculées si elles existent, ou créer des index fonctionnels

```sql
-- Créer des index fonctionnels pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_services_titre_tsvector 
ON services USING GIN (to_tsvector('french', COALESCE(data->'titre_service'->>'valeur', '')));

CREATE INDEX IF NOT EXISTS idx_services_description_tsvector 
ON services USING GIN (to_tsvector('french', COALESCE(data->'description'->>'valeur', '')));
```

**Gain estimé** : **-0.5s**

### Solution 3 : LIMITER LE NOMBRE DE SERVICES ÉVALUÉS

**Problème** : La requête évalue TOUS les services actifs

**Solution** : Filtrer d'abord avec une requête rapide, puis scorer seulement les résultats

```sql
-- ÉTAPE 1 : Filtrage rapide (utilise les index)
WITH quick_filter AS (
    SELECT s.id
    FROM services s
    WHERE s.is_active = true
    AND (
        -- Utiliser les index GIN pour filtrer rapidement
        to_tsvector('french', COALESCE(s.data->'titre_service'->>'valeur', '')) @@ plainto_tsquery('french', $1)
        OR EXISTS (
            SELECT 1 FROM autocomplete_characteristics ac
            WHERE ac.service_id = s.id
            AND ac.valeur ILIKE '%' || $1 || '%'
            LIMIT 1
        )
    )
    LIMIT 100  -- ✅ LIMITER à 100 services max
)
-- ÉTAPE 2 : Scorer seulement ces 100 services
SELECT ...
FROM quick_filter qf
INNER JOIN services s ON s.id = qf.id
```

**Gain estimé** : **-1.5s** (moins de services à scorer)

### Solution 4 : CACHER LES RÉSULTATS

**Problème** : Même recherche répétée = même calcul

**Solution** : Utiliser le cache existant (déjà implémenté mais peut être amélioré)

D'après les logs :
```
[GlobalCache] ❌ Cache miss: search:17669846355517835754
```

Le cache existe mais ne fonctionne pas pour cette requête. Vérifier pourquoi.

**Gain estimé** : **-7s** (si cache hit)

### Solution 5 : OPTIMISER LA REQUÊTE VECTORIELLE

**Problème** : La requête vectorielle optimisée (lignes 432-507) retourne 0 résultats, donc fallback vers keyword_search

**Solution** : Améliorer la requête vectorielle pour qu'elle trouve des résultats

La requête vectorielle prend seulement **12.4ms** mais retourne 0 résultats. Si elle trouvait des résultats, on éviterait le fallback coûteux.

**Gain estimé** : **-4.5s** (éviter keyword_search complètement)

## 🎯 Plan d'action recommandé

### Phase 1 : Quick wins (gain immédiat ~5s)

1. ✅ **Simplifier le scoring** (Solution 1) → **-3.5s**
2. ✅ **Limiter les services évalués** (Solution 3) → **-1.5s**

**Total estimé** : **5s → ~1s** pour keyword_search

### Phase 2 : Optimisations avancées (gain supplémentaire ~2s)

3. ✅ **Améliorer la requête vectorielle** (Solution 5) → **-4.5s** (si elle trouve des résultats)
4. ✅ **Utiliser les index GIN** (Solution 2) → **-0.5s**

### Phase 3 : Cache (gain maximum si cache hit)

5. ✅ **Corriger le cache** (Solution 4) → **-7s** (si cache hit)

## 📝 Conclusion

**Le problème n'est PAS les index** (comme vous l'avez mentionné), mais **la complexité de la requête SQL elle-même** :

1. **14 priorités de scoring** avec `jsonb_array_elements` répétés
2. **Calculs redondants** (même `to_tsvector` calculé plusieurs fois)
3. **Pas de limite** sur le nombre de services évalués
4. **Fallback vers keyword_search** au lieu d'utiliser la requête vectorielle optimisée

**Solution immédiate** : Implémenter les Solutions 1 et 3 pour réduire de **4.46s à ~1s**.

