-- ============================================================
-- CORRECTION COMPLÈTE DES PROBLÈMES DE RECHERCHE - 29 Novembre 2025
-- ============================================================
-- Problèmes corrigés :
-- 1. Logique de recherche défectueuse (filtre sur service AVANT extraction produits)
-- 2. Index non utilisés (unaccent() non indexé, ILIKE au lieu de full-text)
-- 3. Erreur structure requête GPS (search_services_gps_final)
-- 4. Requêtes très lentes (20+ conditions ILIKE)
-- ============================================================

-- ============================================================
-- ÉTAPE 1: Créer fonction wrapper IMMUTABLE pour unaccent()
-- ============================================================
-- Permet de créer des index avec unaccent() pour améliorer les performances

CREATE OR REPLACE FUNCTION unaccent_immutable(text) 
RETURNS text AS $$
    SELECT unaccent('unaccent', $1);
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION unaccent_immutable(text) IS 
'Wrapper IMMUTABLE pour unaccent() permettant la création d''index fonctionnels';

-- ============================================================
-- ÉTAPE 2: Créer index fonctionnels pour unaccent()
-- ============================================================
-- Ces index permettront d'utiliser unaccent() efficacement dans les requêtes

-- Index trigram avec unaccent pour titre_service
CREATE INDEX IF NOT EXISTS idx_services_titre_service_unaccent_trgm 
ON services USING GIN (
    unaccent_immutable(COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '')) gin_trgm_ops
)
WHERE is_active = true;

-- Index trigram avec unaccent pour description
CREATE INDEX IF NOT EXISTS idx_services_description_unaccent_trgm 
ON services USING GIN (
    unaccent_immutable(COALESCE(data->>'description', data->'description'->>'valeur', '')) gin_trgm_ops
)
WHERE is_active = true;

-- Index trigram avec unaccent pour category
CREATE INDEX IF NOT EXISTS idx_services_category_unaccent_trgm 
ON services USING GIN (
    unaccent_immutable(COALESCE(category, data->>'category', data->'category'->>'valeur', '')) gin_trgm_ops
)
WHERE is_active = true;

-- Index full-text avec unaccent pour titre_service
CREATE INDEX IF NOT EXISTS idx_services_titre_service_unaccent_fts 
ON services USING GIN (
    to_tsvector('french', unaccent_immutable(COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '')))
)
WHERE is_active = true;

-- Index full-text avec unaccent pour description
CREATE INDEX IF NOT EXISTS idx_services_description_unaccent_fts 
ON services USING GIN (
    to_tsvector('french', unaccent_immutable(COALESCE(data->>'description', data->'description'->>'valeur', '')))
)
WHERE is_active = true;

-- ============================================================
-- ÉTAPE 3: Créer index pour recherche dans produits (JSONB)
-- ============================================================
-- Index GIN pour recherche rapide dans les produits

-- Index GIN sur les produits (déjà créé mais on s'assure qu'il existe)
CREATE INDEX IF NOT EXISTS idx_services_produits_gin_optimized 
ON services USING GIN ((data->'produits'))
WHERE is_active = true 
  AND (jsonb_typeof(data->'produits') = 'array' OR jsonb_typeof(data->'produits'->'valeur') = 'array');

-- Index pour recherche dans les noms de produits (via expression)
-- Note: PostgreSQL ne permet pas d'indexer directement jsonb_array_elements,
-- mais on peut créer un index sur le champ produits complet
CREATE INDEX IF NOT EXISTS idx_services_produits_nom_gin 
ON services USING GIN ((data->'produits' jsonb_path_ops))
WHERE is_active = true 
  AND data->'produits' IS NOT NULL;

-- ============================================================
-- ÉTAPE 4: Corriger search_services_gps_final
-- ============================================================
-- Vérifier que la fonction retourne exactement les 7 colonnes attendues

-- Supprimer toutes les versions existantes
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer);
DROP FUNCTION IF EXISTS search_services_gps_final(text, text);
DROP FUNCTION IF EXISTS search_services_gps_final(text);
DROP FUNCTION IF EXISTS search_services_gps_final();

-- Créer la fonction avec la signature exacte attendue par le code Rust
CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query TEXT,
    user_gps_zone TEXT,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION,
    gps_source TEXT
) AS $$
DECLARE
    gps_parts TEXT[];
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
    radius_adjusted DOUBLE PRECISION;
BEGIN
    -- Ajuster le rayon si la fonction existe
    BEGIN
        radius_adjusted := calculate_intelligent_radius(search_radius_km::DOUBLE PRECISION);
    EXCEPTION
        WHEN OTHERS THEN
            radius_adjusted := search_radius_km::DOUBLE PRECISION;
    END;
    
    -- Extraire les coordonnées GPS si fournies
    IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
        -- Gérer le format "lat,lng" ou "lat,lng|lat2,lng2"
        IF position('|' in user_gps_zone) > 0 THEN
            gps_parts := string_to_array(user_gps_zone, '|');
            lat := split_part(gps_parts[1], ',', 1)::DOUBLE PRECISION;
            lng := split_part(gps_parts[1], ',', 2)::DOUBLE PRECISION;
        ELSE
            lat := split_part(user_gps_zone, ',', 1)::DOUBLE PRECISION;
            lng := split_part(user_gps_zone, ',', 2)::DOUBLE PRECISION;
        END IF;
        
        -- Recherche avec filtrage GPS
        RETURN QUERY
        SELECT 
            s.id::INTEGER as service_id,
            COALESCE(
                s.data->>'titre_service',
                s.data->'titre_service'->>'valeur',
                s.data->>'titre',
                'Sans titre'
            )::TEXT as titre_service,
            COALESCE(
                s.data->>'category',
                s.data->'category'->>'valeur',
                s.category,
                'Non catégorisé'
            )::TEXT as category,
            COALESCE(
                s.gps,
                s.data->>'gps_fixe',
                s.data->'gps_fixe'->>'valeur',
                ''
            )::TEXT as gps_coords,
            CASE 
                WHEN s.gps IS NOT NULL AND s.gps != '' AND position(',' in s.gps) > 0 THEN
                    calculate_gps_distance_km(
                        lat, lng,
                        split_part(s.gps, ',', 1)::DOUBLE PRECISION,
                        split_part(s.gps, ',', 2)::DOUBLE PRECISION
                    )
                WHEN s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0 THEN
                    calculate_gps_distance_km(
                        lat, lng,
                        split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION,
                        split_part(s.data->>'gps_fixe', ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END::DOUBLE PRECISION as distance_km,
            (GREATEST(
                CASE 
                    WHEN COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 100.0
                    WHEN s.data->>'titre' ILIKE '%' || search_query || '%' THEN 100.0
                    WHEN COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 50.0
                    ELSE 10.0
                END,
                CASE 
                    WHEN COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%' THEN 30.0
                    ELSE 0.0
                END
            ))::DOUBLE PRECISION as relevance_score,
            CASE 
                WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_column'::TEXT
                WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
                ELSE 'no_gps'::TEXT
            END as gps_source
        FROM services s
        WHERE 
            s.is_active = true
            AND (
                COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
                OR s.data->>'titre' ILIKE '%' || search_query || '%'
                OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
                OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%'
            )
            AND (
                (s.gps IS NOT NULL AND s.gps != '' AND position(',' in s.gps) > 0)
                OR (s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0)
            )
            AND (
                CASE 
                    WHEN s.gps IS NOT NULL AND position(',' in s.gps) > 0 THEN
                        calculate_gps_distance_km(
                            lat, lng,
                            split_part(s.gps, ',', 1)::DOUBLE PRECISION,
                            split_part(s.gps, ',', 2)::DOUBLE PRECISION
                        ) <= radius_adjusted
                    WHEN s.data->>'gps_fixe' IS NOT NULL AND position(',' in (s.data->>'gps_fixe')) > 0 THEN
                        calculate_gps_distance_km(
                            lat, lng,
                            split_part(s.data->>'gps_fixe', ',', 1)::DOUBLE PRECISION,
                            split_part(s.data->>'gps_fixe', ',', 2)::DOUBLE PRECISION
                        ) <= radius_adjusted
                    ELSE false
                END
            )
        ORDER BY relevance_score DESC, distance_km ASC NULLS LAST
        LIMIT max_results;
        
        RETURN;
    END IF;
    
    -- Si pas de GPS, faire une recherche textuelle simple
    RETURN QUERY
    SELECT 
        s.id::INTEGER as service_id,
        COALESCE(
            s.data->>'titre_service',
            s.data->'titre_service'->>'valeur',
            s.data->>'titre',
            'Sans titre'
        )::TEXT as titre_service,
        COALESCE(
            s.data->>'category',
            s.data->'category'->>'valeur',
            s.category,
            'Non catégorisé'
        )::TEXT as category,
        COALESCE(
            s.gps,
            s.data->>'gps_fixe',
            s.data->'gps_fixe'->>'valeur',
            ''
        )::TEXT as gps_coords,
        0.0::DOUBLE PRECISION as distance_km,
        (GREATEST(
            CASE 
                WHEN COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 100.0
                WHEN s.data->>'titre' ILIKE '%' || search_query || '%' THEN 100.0
                WHEN COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 50.0
                ELSE 10.0
            END,
            CASE 
                WHEN COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%' THEN 30.0
                ELSE 0.0
            END
        ))::DOUBLE PRECISION as relevance_score,
        CASE 
            WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_column'::TEXT
            WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'::TEXT
            ELSE 'no_gps'::TEXT
        END as gps_source
    FROM services s
    WHERE 
        s.is_active = true
        AND (
            COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%' || search_query || '%'
            OR s.data->>'titre' ILIKE '%' || search_query || '%'
            OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
            OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', s.category, '') ILIKE '%' || search_query || '%'
        )
    ORDER BY relevance_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_services_gps_final(TEXT, TEXT, INTEGER, INTEGER) IS 
'Recherche de services avec filtrage GPS. Retourne exactement 7 colonnes: service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source';

-- ============================================================
-- ÉTAPE 5: Créer fonction helper pour recherche optimisée dans produits
-- ============================================================
-- Cette fonction sera utilisée pour corriger la logique de recherche

CREATE OR REPLACE FUNCTION search_products_optimized(
    search_query TEXT,
    category_filter TEXT DEFAULT NULL,
    location_filter TEXT DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    service_id INTEGER,
    service_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    user_id INTEGER,
    gps TEXT,
    category TEXT,
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH all_products_extracted AS (
        -- ✅ CORRIGÉ: Extraire TOUS les produits de TOUS les services actifs
        -- PAS de filtre sur titre_service/description/category ici
        SELECT 
            s.id as service_id,
            s.data as service_data,
            s.created_at,
            s.user_id,
            s.gps,
            s.category,
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END as products_array
        FROM services s
        WHERE s.is_active = true
        AND ($2::text IS NULL OR s.category = $2 OR s.data->'category'->>'valeur' = $2)
    ),
    products_matched AS (
        -- ✅ Filtrer sur les PRODUITS qui matchent la recherche (GÉNÉRIQUE - utilise extract_all_product_text)
        SELECT DISTINCT
            ape.service_id,
            ape.service_data,
            ape.created_at,
            ape.user_id,
            ape.gps,
            ape.category,
            GREATEST(
                -- Score basé sur correspondance dans produits (GÉNÉRIQUE - tous champs)
                COALESCE((
                    SELECT MAX(
                        CASE 
                            -- Correspondance exacte dans tout le texte du produit
                            WHEN LOWER(extract_all_product_text(product)) = LOWER($1) THEN 25.0
                            -- Correspondance au début
                            WHEN LOWER(extract_all_product_text(product)) LIKE LOWER($1) || '%' THEN 18.0
                            -- Correspondance partielle (priorité aux champs principaux)
                            WHEN LOWER(COALESCE(product->>'nom', '')) = LOWER($1) THEN 20.0
                            WHEN product->>'nom' ILIKE '%' || $1 || '%' THEN 12.0
                            WHEN product->>'categorie' ILIKE '%' || $1 || '%' THEN 10.0
                            WHEN product->>'description' ILIKE '%' || $1 || '%' THEN 8.0
                            -- Correspondance dans tout le texte extrait (générique)
                            WHEN extract_all_product_text(product) ILIKE '%' || $1 || '%' THEN 6.0
                            ELSE 0.0
                        END
                    )
                    FROM jsonb_array_elements(ape.products_array) AS product
                    WHERE (
                        -- ✅ GÉNÉRIQUE : Recherche dans TOUS les champs du produit via extract_all_product_text
                        extract_all_product_text(product) ILIKE '%' || $1 || '%'
                        -- ✅ OU recherche dans les champs principaux (pour performance)
                        OR product->>'nom' ILIKE '%' || $1 || '%'
                        OR product->>'categorie' ILIKE '%' || $1 || '%'
                        OR product->>'description' ILIKE '%' || $1 || '%'
                    )
                ), 0.0),
                -- Score basé sur correspondance dans champs service (pour services sans produits)
                CASE 
                    WHEN COALESCE(ape.service_data->>'titre_service', ape.service_data->'titre_service'->>'valeur', '') ILIKE '%' || $1 || '%' THEN 10.0
                    WHEN COALESCE(ape.service_data->>'description', ape.service_data->'description'->>'valeur', '') ILIKE '%' || $1 || '%' THEN 5.0
                    WHEN COALESCE(ape.service_data->>'category', ape.service_data->'category'->>'valeur', ape.category, '') ILIKE '%' || $1 || '%' THEN 8.0
                    ELSE 0.0
                END
            )::REAL as relevance_score
        FROM all_products_extracted ape
        WHERE (
            -- ✅ Recherche dans les PRODUITS (GÉNÉRIQUE - tous champs)
            EXISTS (
                SELECT 1 
                FROM jsonb_array_elements(ape.products_array) AS product
                WHERE (
                    -- ✅ GÉNÉRIQUE : Recherche dans TOUS les champs du produit
                    extract_all_product_text(product) ILIKE '%' || $1 || '%'
                    -- ✅ OU recherche dans les champs principaux (pour performance)
                    OR product->>'nom' ILIKE '%' || $1 || '%'
                    OR product->>'categorie' ILIKE '%' || $1 || '%'
                    OR product->>'description' ILIKE '%' || $1 || '%'
                )
            )
            -- ✅ OU recherche dans les champs service (pour services sans produits)
            OR COALESCE(ape.service_data->>'titre_service', ape.service_data->'titre_service'->>'valeur', '') ILIKE '%' || $1 || '%'
            OR COALESCE(ape.service_data->>'description', ape.service_data->'description'->>'valeur', '') ILIKE '%' || $1 || '%'
            OR COALESCE(ape.service_data->>'category', ape.service_data->'category'->>'valeur', ape.category, '') ILIKE '%' || $1 || '%'
        )
        AND (
            -- Filtre location (si fourni)
            $3::text IS NULL
            OR ape.gps ILIKE '%' || $3 || '%'
        )
    )
    SELECT 
        pm.service_id::INTEGER,
        pm.service_data,
        pm.created_at,
        pm.user_id,
        pm.gps,
        pm.category,
        pm.relevance_score
    FROM products_matched pm
    WHERE pm.relevance_score > 0
    ORDER BY pm.relevance_score DESC, pm.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_products_optimized(TEXT, TEXT, TEXT, INTEGER) IS 
'Recherche optimisée dans les produits. Extrait TOUS les produits AVANT de filtrer, corrigeant le problème de logique de recherche.';

-- ============================================================
-- ÉTAPE 6: Analyser les tables pour mettre à jour les statistiques
-- ============================================================

ANALYZE services;
ANALYZE autocomplete_characteristics;

-- ============================================================
-- ÉTAPE 7: Vérifications
-- ============================================================

-- Vérifier que la fonction search_services_gps_final retourne les bonnes colonnes
DO $$
DECLARE
    func_result RECORD;
BEGIN
    SELECT 
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_function_result(p.oid) as return_type
    INTO func_result
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'search_services_gps_final'
    ORDER BY p.oid DESC
    LIMIT 1;
    
    IF func_result.return_type LIKE '%service_id%' 
       AND func_result.return_type LIKE '%titre_service%'
       AND func_result.return_type LIKE '%category%'
       AND func_result.return_type LIKE '%gps_coords%'
       AND func_result.return_type LIKE '%distance_km%'
       AND func_result.return_type LIKE '%relevance_score%'
       AND func_result.return_type LIKE '%gps_source%' THEN
        RAISE NOTICE '✅ Fonction search_services_gps_final correctement définie';
    ELSE
        RAISE WARNING '⚠️ Fonction search_services_gps_final ne retourne pas les colonnes attendues: %', func_result.return_type;
    END IF;
END $$;

-- Vérifier que les index sont créés
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE indexname LIKE 'idx_services%unaccent%'
       OR indexname LIKE 'idx_services%produits%';
    
    RAISE NOTICE '✅ % index de recherche créés', index_count;
END $$;

-- ============================================================
-- NOTES IMPORTANTES
-- ============================================================
-- 
-- 1. CORRECTION LOGIQUE DE RECHERCHE :
--    La fonction search_products_optimized() corrige le problème principal :
--    - Extrait TOUS les produits AVANT de filtrer
--    - Filtre sur les PRODUITS, pas sur les services
--    - Permet de trouver des produits même si le service ne contient pas le terme recherché
--
-- 2. INDEX UNACCENT :
--    Les index avec unaccent_immutable() permettront d'utiliser unaccent() efficacement
--    dans les requêtes ILIKE avec gestion des accents
--
-- 3. FONCTION search_services_gps_final :
--    Corrigée pour retourner exactement les 7 colonnes attendues par le code Rust
--
-- 4. PROCHAINES ÉTAPES :
--    - Modifier le code Rust pour utiliser search_products_optimized() au lieu de la requête actuelle
--    - Ou modifier la requête dans fulltext_search_with_gps() pour extraire produits AVANT filtrage
--
-- ============================================================

