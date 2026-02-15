-- Migration pour améliorer la recherche dans TOUS les champs des produits
-- Date: 2025-10-20
-- Description: Indexe dynamiquement tous les champs JSONB des produits, peu importe le type

-- 1. Fonction pour extraire récursivement tous les textes d'un produit JSONB
CREATE OR REPLACE FUNCTION extract_all_product_text(product JSONB)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    key TEXT;
    value JSONB;
BEGIN
    -- Parcourir toutes les clés du produit
    FOR key, value IN SELECT * FROM jsonb_each(product)
    LOOP
        -- Si c'est une chaîne, l'ajouter
        IF jsonb_typeof(value) = 'string' THEN
            result := result || ' ' || (value #>> '{}');
        
        -- Si c'est un tableau, extraire tous les éléments
        ELSIF jsonb_typeof(value) = 'array' THEN
            result := result || ' ' || (
                SELECT string_agg(elem #>> '{}', ' ')
                FROM jsonb_array_elements_text(value) AS elem
            );
        
        -- Si c'est un objet, extraire récursivement
        ELSIF jsonb_typeof(value) = 'object' THEN
            -- Pour les objets simples, extraire les valeurs
            result := result || ' ' || (
                SELECT string_agg(v #>> '{}', ' ')
                FROM jsonb_each(value) AS kv(k, v)
                WHERE jsonb_typeof(kv.v) = 'string'
            );
        
        -- Si c'est un booléen ou nombre, le convertir en texte
        ELSIF jsonb_typeof(value) IN ('boolean', 'number') THEN
            result := result || ' ' || (value #>> '{}');
        END IF;
    END LOOP;
    
    RETURN trim(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Fonction utilitaire pour agréger le texte de tous les produits d'un service
CREATE OR REPLACE FUNCTION extract_service_products_text(service_data JSONB)
RETURNS TEXT AS $$
DECLARE
    aggregated TEXT := '';
    products JSONB;
    product_record JSONB;
BEGIN
    products := CASE 
        WHEN jsonb_typeof(service_data->'produits') = 'array' 
        THEN service_data->'produits'
        ELSE '[]'::jsonb
    END;

    FOR product_record IN SELECT * FROM jsonb_array_elements(products)
    LOOP
        aggregated := aggregated || ' ' || extract_all_product_text(product_record);
    END LOOP;

    RETURN trim(aggregated);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Index GIN sur le texte extrait de tous les produits
CREATE INDEX IF NOT EXISTS idx_services_products_fulltext_all 
ON services USING GIN (
    to_tsvector('french', extract_service_products_text(data))
);

-- 4. Fonction améliorée de scoring produits qui cherche dans TOUS les champs
CREATE OR REPLACE FUNCTION calculate_product_relevance_score_v2(
    service_data JSONB,
    search_query TEXT
)
RETURNS FLOAT AS $$
DECLARE
    products JSONB;
    total_score FLOAT := 0.0;
    product_record JSONB;
    product_text TEXT;
BEGIN
    -- Extraire les produits
    products := CASE 
        WHEN jsonb_typeof(service_data->'produits') = 'array' 
        THEN service_data->'produits'
        ELSE '[]'::jsonb
    END;
    
    -- Parcourir chaque produit
    FOR product_record IN SELECT * FROM jsonb_array_elements(products)
    LOOP
        -- Extraire tout le texte du produit (tous champs confondus)
        product_text := extract_all_product_text(product_record);
        
        -- Calculer le score full-text
        total_score := total_score + ts_rank(
            to_tsvector('french', product_text),
            plainto_tsquery('french', search_query)
        ) * 3.0;
        
        -- Bonus pour correspondances exactes dans les champs clés
        IF product_record->>'nom' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 5.0;
        END IF;
        
        IF product_record->>'description' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 3.0;
        END IF;
        
        -- Bonus pour champs spécifiques métier (nouveaux champs)
        -- Clinique/Hôpital
        IF product_record->>'typeEtablissement' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 4.0;
        END IF;
        
        IF product_record->'prestationsMedicales' IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(product_record->'prestationsMedicales') AS prestation
                WHERE prestation ILIKE '%' || search_query || '%'
            ) THEN
                total_score := total_score + 4.0;
            END IF;
        END IF;
        
        -- Déménagement
        IF product_record->>'typeDemenagement' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 4.0;
        END IF;
        
        IF product_record->>'typeVehicule' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 3.0;
        END IF;
        
        -- Autres champs fréquents
        IF product_record->>'marque' ILIKE '%' || search_query || '%' OR
           product_record->>'modele' ILIKE '%' || search_query || '%' OR
           product_record->>'ville' ILIKE '%' || search_query || '%' OR
           product_record->>'quartier' ILIKE '%' || search_query || '%' OR
           product_record->>'couleur' ILIKE '%' || search_query || '%' OR
           product_record->>'taille' ILIKE '%' || search_query || '%' THEN
            total_score := total_score + 2.5;
        END IF;
    END LOOP;
    
    RETURN total_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Vue matérialisée pour cache de recherche produits (optionnel, pour performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS products_search_cache AS
SELECT 
    s.id as service_id,
    s.user_id,
    s.data->'titre_service'->>'valeur' as titre,
    s.data->'category'->>'valeur' as category,
    jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            ELSE '[]'::jsonb
        END
    ) as product,
    to_tsvector('french', extract_all_product_text(
        jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        )
    )) as product_tsvector
FROM services s
WHERE s.is_active = TRUE;

-- Index sur la vue matérialisée
CREATE INDEX IF NOT EXISTS idx_products_search_cache_tsvector 
ON products_search_cache USING GIN(product_tsvector);

CREATE INDEX IF NOT EXISTS idx_products_search_cache_service 
ON products_search_cache(service_id);

-- 5. Fonction de rafraîchissement automatique (à appeler périodiquement)
CREATE OR REPLACE FUNCTION refresh_products_search_cache()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY products_search_cache;
END;
$$ LANGUAGE plpgsql;

-- 6. Amélioration de la fonction de recherche existante
-- Remplacer l'ancien scoring produits par le nouveau
COMMENT ON FUNCTION calculate_product_relevance_score_v2 IS 'Calcule le score en recherchant dans TOUS les champs JSONB des produits (clinique, déménagement, etc.)';
COMMENT ON FUNCTION extract_all_product_text IS 'Extrait récursivement tout le texte d''un produit JSONB pour indexation full-text';
COMMENT ON MATERIALIZED VIEW products_search_cache IS 'Cache de recherche produits avec tsvector pré-calculé pour performance';

-- 7. Trigger pour rafraîchir le cache quand un service est modifié (optionnel)
-- Note: REFRESH MATERIALIZED VIEW CONCURRENTLY nécessite un UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_search_cache_unique 
ON products_search_cache(service_id, (product->>'id'));

-- 8. Fonction de recherche optimisée utilisant le cache
-- ✅ CORRIGÉ 2026-02-15: Supprimer toutes les versions de la fonction avant de la recréer
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
        FROM pg_proc 
        WHERE proname = 'search_products_optimized'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', 
            func_record.proname, 
            func_record.args
        );
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION search_products_optimized(
    search_query TEXT,
    category_filter TEXT DEFAULT NULL,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE(
    service_id INTEGER,
    product JSONB,
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        psc.service_id,
        psc.product,
        ts_rank(psc.product_tsvector, plainto_tsquery('french', search_query)) as score
    FROM products_search_cache psc
    WHERE 
        (category_filter IS NULL OR psc.category ILIKE '%' || category_filter || '%')
        AND psc.product_tsvector @@ plainto_tsquery('french', search_query)
    ORDER BY score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Commentaires
COMMENT ON FUNCTION search_products_optimized IS 'Recherche optimisée dans les produits utilisant le cache matérialisé';

-- Note pour l'utilisation :
-- Pour mettre à jour le cache : SELECT refresh_products_search_cache();
-- Créer un cron job ou trigger selon les besoins de fraîcheur des données

