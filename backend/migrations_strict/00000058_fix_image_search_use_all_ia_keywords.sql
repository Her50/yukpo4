-- Migration: Recherche image - Utiliser TOUS les mots-clés du JSON IA de manière générique
-- Date: 2026-01-15
-- Description: Extrait TOUS les mots-clés du JSON IA (description, tags, caracteristiques_cles)
--              de manière générique et fait une recherche textuelle classique dans les caractéristiques des produits

-- =====================================================
-- 1. Fonction Helper pour Extraire Tous les Mots-clés d'un JSON IA (GÉNÉRIQUE)
-- =====================================================

CREATE OR REPLACE FUNCTION extract_all_keywords_from_ia_json_generic(
    search_query TEXT,
    search_tags TEXT[],
    search_category TEXT,
    caracteristiques_cles JSONB
)
RETURNS TEXT[] AS $$
DECLARE
    all_keywords TEXT[] := ARRAY[]::TEXT[];
    keyword TEXT;
    key TEXT;
    value TEXT;
    word TEXT;
BEGIN
    -- 1. Ajouter search_query (diviser en mots individuels)
    IF search_query IS NOT NULL AND search_query != '' THEN
        SELECT array_agg(DISTINCT trim(word))
        INTO all_keywords
        FROM unnest(string_to_array(normalize_text(search_query), ' ')) AS word
        WHERE trim(word) != '' AND length(trim(word)) > 2;  -- Ignorer mots trop courts
    END IF;
    
    -- 2. Ajouter tous les tags (déjà normalisés)
    IF search_tags IS NOT NULL AND array_length(search_tags, 1) > 0 THEN
        all_keywords := all_keywords || normalize_word_array(search_tags);
    END IF;
    
    -- 3. Ajouter la catégorie
    IF search_category IS NOT NULL AND search_category != '' THEN
        all_keywords := array_append(all_keywords, normalize_text(search_category));
    END IF;
    
    -- 4. ✅ GÉNÉRIQUE: Extraire TOUTES les valeurs de caracteristiques_cles (sans présupposer de structure)
    IF caracteristiques_cles IS NOT NULL THEN
        FOR key, value IN SELECT * FROM jsonb_each_text(caracteristiques_cles)
        LOOP
            -- Ajouter la clé normalisée (ex: "marque", "couleur", "taille", etc.)
            IF key IS NOT NULL AND key != '' THEN
                all_keywords := array_append(all_keywords, normalize_text(key));
            END IF;
            
            -- Traiter la valeur (peut être string, array, ou autre)
            IF value IS NOT NULL AND value != '' THEN
                -- Vérifier si c'est un tableau JSON
                IF value LIKE '[%' THEN
                    -- C'est un tableau JSON, extraire chaque élément
                    DECLARE
                        json_array JSONB;
                        array_element TEXT;
                    BEGIN
                        BEGIN
                            json_array := value::JSONB;
                            FOR array_element IN SELECT jsonb_array_elements_text(json_array)
                            LOOP
                                IF array_element IS NOT NULL AND array_element != '' THEN
                                    -- Diviser en mots si nécessaire
                                    FOR word IN SELECT unnest(string_to_array(normalize_text(array_element), ' '))
                                    LOOP
                                        IF word IS NOT NULL AND word != '' AND length(word) > 2 THEN
                                            all_keywords := array_append(all_keywords, word);
                                        END IF;
                                    END LOOP;
                                END IF;
                            END LOOP;
                        EXCEPTION WHEN OTHERS THEN
                            -- Si erreur parsing JSON, traiter comme string simple
                            FOR word IN SELECT unnest(string_to_array(normalize_text(value), ' '))
                            LOOP
                                IF word IS NOT NULL AND word != '' AND length(word) > 2 THEN
                                    all_keywords := array_append(all_keywords, word);
                                END IF;
                            END LOOP;
                        END;
                    END;
                ELSE
                    -- Valeur simple, diviser en mots
                    FOR word IN SELECT unnest(string_to_array(normalize_text(value), ' '))
                    LOOP
                        IF word IS NOT NULL AND word != '' AND length(word) > 2 THEN
                            all_keywords := array_append(all_keywords, word);
                        END IF;
                    END LOOP;
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    -- 5. Supprimer les doublons et les valeurs vides
    SELECT array_agg(DISTINCT kw)
    INTO all_keywords
    FROM unnest(all_keywords) AS kw
    WHERE kw IS NOT NULL AND kw != '' AND length(kw) > 2;
    
    RETURN COALESCE(all_keywords, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_all_keywords_from_ia_json_generic IS 'Extrait TOUS les mots-clés du JSON IA de manière générique (description, tags, caracteristiques_cles) sans présupposer de structure';

-- =====================================================
-- 2. Fonction de Recherche Textuelle dans Caractéristiques Produits (GÉNÉRIQUE)
-- =====================================================

CREATE OR REPLACE FUNCTION search_in_product_characteristics_generic(
    product_data JSONB,
    keywords TEXT[]
)
RETURNS BOOLEAN AS $$
DECLARE
    keyword TEXT;
    search_text TEXT := '';
    prod_key TEXT;
    prod_value TEXT;
    sc_key TEXT;
    sc_value TEXT;
    sc_element TEXT;
    json_array JSONB;
BEGIN
    -- Construire un texte de recherche depuis TOUTES les caractéristiques du produit (générique)
    
    -- 1. Extraire toutes les valeurs textuelles du produit (récursif)
    FOR prod_key, prod_value IN SELECT * FROM jsonb_each_text(product_data)
    LOOP
        IF prod_value IS NOT NULL AND prod_value != '' THEN
            -- Si c'est un tableau JSON
            IF prod_value LIKE '[%' THEN
                BEGIN
                    json_array := prod_value::JSONB;
                    FOR sc_element IN SELECT jsonb_array_elements_text(json_array)
                    LOOP
                        IF sc_element IS NOT NULL AND sc_element != '' THEN
                            search_text := search_text || ' ' || sc_element;
                        END IF;
                    END LOOP;
                EXCEPTION WHEN OTHERS THEN
                    -- Si erreur, traiter comme string simple
                    search_text := search_text || ' ' || prod_value;
                END;
            ELSE
                -- Valeur simple
                search_text := search_text || ' ' || prod_value;
            END IF;
        END IF;
    END LOOP;
    
    -- 2. Extraire récursivement depuis sous_caracteristiques (si existe)
    IF product_data ? 'sous_caracteristiques' THEN
        FOR sc_key, sc_value IN SELECT * FROM jsonb_each_text(product_data->'sous_caracteristiques')
        LOOP
            -- Ajouter la clé
            IF sc_key IS NOT NULL AND sc_key != '' THEN
                search_text := search_text || ' ' || sc_key;
            END IF;
            
            -- Ajouter la valeur (peut être string ou array)
            IF sc_value IS NOT NULL AND sc_value != '' THEN
                IF sc_value LIKE '[%' THEN
                    -- C'est un tableau JSON
                    BEGIN
                        json_array := sc_value::JSONB;
                        FOR sc_element IN SELECT jsonb_array_elements_text(json_array)
                        LOOP
                            IF sc_element IS NOT NULL AND sc_element != '' THEN
                                search_text := search_text || ' ' || sc_element;
                            END IF;
                        END LOOP;
                    EXCEPTION WHEN OTHERS THEN
                        search_text := search_text || ' ' || sc_value;
                    END;
                ELSE
                    -- Valeur simple
                    search_text := search_text || ' ' || sc_value;
                END IF;
            END IF;
        END LOOP;
    END IF;
    
    -- Normaliser le texte de recherche
    search_text := normalize_text(search_text);
    
    -- Vérifier si au moins un mot-clé est présent dans le texte
    IF keywords IS NULL OR array_length(keywords, 1) IS NULL OR array_length(keywords, 1) = 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Recherche: au moins un mot-clé doit matcher
    FOREACH keyword IN ARRAY keywords
    LOOP
        IF keyword IS NOT NULL AND keyword != '' AND length(keyword) > 2 THEN
            IF search_text LIKE '%' || keyword || '%' THEN
                RETURN TRUE;
            END IF;
        END IF;
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION search_in_product_characteristics_generic IS 'Recherche textuelle générique dans TOUTES les caractéristiques d''un produit (nom, description, sous_caracteristiques, etc.)';

-- =====================================================
-- 3. Mise à Jour de la Fonction search_images_by_ai_analysis (GÉNÉRIQUE)
-- =====================================================

-- Supprimer toutes les versions existantes de la fonction
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'search_images_by_ai_analysis'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION search_images_by_ai_analysis(
    search_query TEXT,
    search_tags TEXT[],
    search_category TEXT DEFAULT NULL,
    search_marque TEXT DEFAULT NULL,
    search_couleur TEXT DEFAULT NULL,
    gps_lat FLOAT DEFAULT NULL,
    gps_lng FLOAT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20,
    detected_lang TEXT DEFAULT 'french',
    search_couleurs TEXT[] DEFAULT NULL,  -- Gardé pour compatibilité mais pas utilisé directement
    caracteristiques_cles JSONB DEFAULT NULL  -- ✅ NOUVEAU: Caractéristiques clés du JSON IA (générique)
)
RETURNS TABLE (
    service_id INTEGER,
    media_id INTEGER,
    media_path TEXT,
    product_name TEXT,
    ai_description TEXT,
    ai_tags TEXT[],
    match_score FLOAT,
    distance_km FLOAT,
    service_data JSONB
) AS $$
DECLARE
    normalized_search_query TEXT;
    normalized_search_tags TEXT[];
    lang_config regconfig;
    all_keywords TEXT[];  -- ✅ Tous les mots-clés extraits du JSON IA (générique)
BEGIN
    -- Convertir la langue TEXT en regconfig
    lang_config := get_text_search_config(detected_lang);
    
    -- Normaliser les paramètres de recherche
    normalized_search_query := normalize_text(search_query);
    normalized_search_tags := normalize_word_array(search_tags);
    
    -- ✅ GÉNÉRIQUE: Extraire TOUS les mots-clés du JSON IA (sans présupposer de structure)
    all_keywords := extract_all_keywords_from_ia_json_generic(
        normalized_search_query,
        normalized_search_tags,
        COALESCE(search_category, ''),
        caracteristiques_cles
    );
    
    RETURN QUERY
    WITH ranked_results AS (
        SELECT 
            s.id as service_id,
            m.id as media_id,
            m.path as media_path,
            COALESCE(
                product->>'nom',
                product->>'name',
                product->>'titre',
                'Produit'
            ) as product_name,
            m.ai_description,
            m.ai_tags,
            (
                -- ✅ Score principal: Recherche textuelle générique dans caractéristiques produits
                CASE 
                    WHEN search_in_product_characteristics_generic(product, all_keywords) THEN 100.0
                    ELSE 0.0
                END +
                
                -- Bonus pour match exact sur nom de produit
                CASE 
                    WHEN normalized_search_query != '' AND (
                        COALESCE(product->>'nom', '') ILIKE '%' || normalized_search_query || '%'
                        OR COALESCE(product->>'name', '') ILIKE '%' || normalized_search_query || '%'
                        OR COALESCE(product->>'titre', '') ILIKE '%' || normalized_search_query || '%'
                    )
                    THEN 50.0
                    ELSE 0.0
                END +
                
                -- Bonus pour match sur catégorie
                CASE 
                    WHEN search_category IS NOT NULL AND (
                        COALESCE(product->>'categorie', '') ILIKE '%' || search_category || '%'
                        OR COALESCE(product->>'category', '') ILIKE '%' || search_category || '%'
                        OR COALESCE(s.data->>'categorie', '') ILIKE '%' || search_category || '%'
                    )
                    THEN 60.0
                    ELSE 0.0
                END +
                
                -- Bonus pour match sur description IA (si disponible et non générique)
                CASE 
                    WHEN m.normalized_ai_description IS NOT NULL 
                         AND m.normalized_ai_description NOT ILIKE '%image générée automatiquement%'
                         AND normalized_search_query != ''
                         AND m.normalized_ai_description LIKE '%' || normalized_search_query || '%'
                    THEN 30.0
                    ELSE 0.0
                END +
                
                -- Bonus tags communs
                (SELECT COUNT(*) * 15.0 
                 FROM unnest(COALESCE(m.normalized_ai_tags, ARRAY[]::TEXT[])) tag 
                 WHERE tag = ANY(normalized_search_tags)) +
                
                -- Bonus confidence
                (COALESCE(m.ai_confidence, 0.5) * 10.0)
                
            )::FLOAT as match_score,
            
            -- Calcul distance GPS si coordonnées fournies
            CASE 
                WHEN gps_lat IS NOT NULL AND gps_lng IS NOT NULL 
                     AND s.gps IS NOT NULL AND s.gps != '' 
                     AND s.gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
                THEN
                    ST_Distance(
                        ST_Point(gps_lng, gps_lat)::geography,
                        ST_Point(
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0),
                            COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0)
                        )::geography
                    ) / 1000.0
                ELSE NULL
            END as distance_km,
            
            s.data as service_data,
            product
        FROM services s
        INNER JOIN media m ON m.service_id = s.id
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE s.is_active = true
        AND m.type = 'image'
        AND (
            -- ✅ Recherche textuelle générique dans caractéristiques produits avec TOUS les mots-clés
            search_in_product_characteristics_generic(product, all_keywords)
            -- OU recherche classique sur description IA (si disponible et non générique)
            OR (
                m.ai_description IS NOT NULL 
                AND m.normalized_ai_description NOT ILIKE '%image générée automatiquement%'
                AND (
                    to_tsvector(lang_config, COALESCE(m.normalized_ai_description, '')) @@ plainto_tsquery(lang_config, normalized_search_query)
                    OR m.normalized_ai_tags && normalized_search_tags
                )
            )
        )
        -- Filtre GPS si coordonnées fournies
        AND (
            gps_lat IS NULL 
            OR gps_lng IS NULL
            OR search_radius_km IS NULL
            OR s.gps IS NULL
            OR s.gps = ''
            OR s.gps !~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
            OR ST_Distance(
                ST_Point(gps_lng, gps_lat)::geography,
                ST_Point(
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 2) AS FLOAT), 0.0),
                    COALESCE(CAST(SPLIT_PART(s.gps, ',', 1) AS FLOAT), 0.0)
                )::geography
            ) / 1000.0 <= search_radius_km
        )
    )
    SELECT 
        ranked_results.service_id,
        ranked_results.media_id,
        ranked_results.media_path,
        ranked_results.product_name,
        ranked_results.ai_description,
        ranked_results.ai_tags,
        ranked_results.match_score,
        ranked_results.distance_km,
        ranked_results.service_data
    FROM ranked_results
    WHERE ranked_results.match_score > 0.0
    ORDER BY 
        ranked_results.match_score DESC,
        ranked_results.distance_km ASC NULLS LAST
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_images_by_ai_analysis IS 'Recherche intelligente d''images utilisant TOUS les mots-clés du JSON IA de manière générique pour recherche textuelle dans caractéristiques produits';

-- =====================================================
-- 4. Vérification
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'extract_all_keywords_from_ia_json_generic'
    ) THEN
        RAISE EXCEPTION 'Fonction extract_all_keywords_from_ia_json_generic non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_in_product_characteristics_generic'
    ) THEN
        RAISE EXCEPTION 'Fonction search_in_product_characteristics_generic non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_images_by_ai_analysis'
    ) THEN
        RAISE EXCEPTION 'Fonction search_images_by_ai_analysis non créée';
    END IF;
    
    RAISE NOTICE '✅ Migration recherche image (utilisation tous mots-clés JSON IA générique) appliquée avec succès';
END $$;
