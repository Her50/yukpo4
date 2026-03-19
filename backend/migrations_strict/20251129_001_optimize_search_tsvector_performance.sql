-- Migration: Optimisation recherche avec tsvector au lieu d'ILIKE
-- Date: 2025-11-29
-- Objectif: Remplacer ILIKE par recherche full-text PostgreSQL pour performance < 500ms
-- ✅ SÉCURISÉ: Vérifie l'existence des index avant de les créer pour éviter doublons

-- 1. Créer index tsvector pour recherche full-text sur titre_service (si n'existe pas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_titre_service_tsvector'
    ) THEN
        CREATE INDEX idx_services_titre_service_tsvector 
        ON services USING GIN (
            to_tsvector('french', 
                COALESCE(data->'titre_service'->>'valeur', '') || ' ' ||
                COALESCE(data->>'titre_service', '')
            )
        );
        RAISE NOTICE 'Index idx_services_titre_service_tsvector créé';
    ELSE
        RAISE NOTICE 'Index idx_services_titre_service_tsvector existe déjà, ignoré';
    END IF;
END $$;

-- 2. Créer index tsvector pour recherche full-text sur description (si n'existe pas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_description_tsvector'
    ) THEN
        CREATE INDEX idx_services_description_tsvector 
        ON services USING GIN (
            to_tsvector('french', 
                COALESCE(data->'description'->>'valeur', '') || ' ' ||
                COALESCE(data->>'description', '') || ' ' ||
                COALESCE(data->'description_service'->>'valeur', '')
            )
        );
        RAISE NOTICE 'Index idx_services_description_tsvector créé';
    ELSE
        RAISE NOTICE 'Index idx_services_description_tsvector existe déjà, ignoré';
    END IF;
END $$;

-- 3. Créer index tsvector pour recherche full-text sur category (si n'existe pas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_category_tsvector'
    ) THEN
        CREATE INDEX idx_services_category_tsvector 
        ON services USING GIN (
            to_tsvector('french', 
                COALESCE(category, '') || ' ' ||
                COALESCE(data->'category'->>'valeur', '') || ' ' ||
                COALESCE(data->>'category', '')
            )
        );
        RAISE NOTICE 'Index idx_services_category_tsvector créé';
    ELSE
        RAISE NOTICE 'Index idx_services_category_tsvector existe déjà, ignoré';
    END IF;
END $$;

-- 4. Créer index tsvector combiné pour recherche globale rapide (si n'existe pas)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_search_combined_tsvector'
    ) THEN
        CREATE INDEX idx_services_search_combined_tsvector 
        ON services USING GIN (
            to_tsvector('french', 
                COALESCE(data->'titre_service'->>'valeur', '') || ' ' ||
                COALESCE(data->>'titre_service', '') || ' ' ||
                COALESCE(data->'description'->>'valeur', '') || ' ' ||
                COALESCE(data->>'description', '') || ' ' ||
                COALESCE(category, '') || ' ' ||
                COALESCE(data->'category'->>'valeur', '')
            )
        ) WHERE is_active = true;
        RAISE NOTICE 'Index idx_services_search_combined_tsvector créé';
    ELSE
        RAISE NOTICE 'Index idx_services_search_combined_tsvector existe déjà, ignoré';
    END IF;
END $$;

-- 5. Créer fonction helper pour extraire texte des produits (optimisée) - Remplace si existe déjà
CREATE OR REPLACE FUNCTION extract_product_search_text(products_jsonb JSONB)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    product JSONB;
BEGIN
    -- Si c'est un array direct
    IF jsonb_typeof(products_jsonb) = 'array' THEN
        FOR product IN SELECT * FROM jsonb_array_elements(products_jsonb)
        LOOP
            result := result || ' ' || COALESCE(product->>'nom', '') || ' ' ||
                      COALESCE(product->>'name', '') || ' ' ||
                      COALESCE(product->>'description', '') || ' ' ||
                      COALESCE(product->>'type', '') || ' ' ||
                      COALESCE(product->>'marque', '') || ' ' ||
                      COALESCE(product->>'modele', '');
        END LOOP;
    -- Si c'est un object avec valeur (array)
    ELSIF jsonb_typeof(products_jsonb->'valeur') = 'array' THEN
        FOR product IN SELECT * FROM jsonb_array_elements(products_jsonb->'valeur')
        LOOP
            result := result || ' ' || COALESCE(product->>'nom', '') || ' ' ||
                      COALESCE(product->>'name', '') || ' ' ||
                      COALESCE(product->>'description', '') || ' ' ||
                      COALESCE(product->>'type', '') || ' ' ||
                      COALESCE(product->>'marque', '') || ' ' ||
                      COALESCE(product->>'modele', '');
        END LOOP;
    END IF;
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Créer index tsvector pour produits (optimisé) - si n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexname = 'idx_services_products_tsvector'
    ) THEN
        CREATE INDEX idx_services_products_tsvector 
        ON services USING GIN (
            to_tsvector('french', extract_product_search_text(
                CASE 
                    WHEN jsonb_typeof(data->'produits') = 'array' 
                    THEN data->'produits'
                    WHEN jsonb_typeof(data->'produits'->'valeur') = 'array'
                    THEN data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END
            ))
        ) WHERE is_active = true;
        RAISE NOTICE 'Index idx_services_products_tsvector créé';
    ELSE
        RAISE NOTICE 'Index idx_services_products_tsvector existe déjà, ignoré';
    END IF;
END $$;

-- 7. Analyser les index pour optimiser les statistiques
ANALYZE services;

-- 8. Commentaires (utiliser DO pour vérifier existence)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_titre_service_tsvector') THEN
        COMMENT ON INDEX idx_services_titre_service_tsvector IS 'Index full-text pour recherche rapide dans titre_service';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_description_tsvector') THEN
        COMMENT ON INDEX idx_services_description_tsvector IS 'Index full-text pour recherche rapide dans description';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_category_tsvector') THEN
        COMMENT ON INDEX idx_services_category_tsvector IS 'Index full-text pour recherche rapide dans category';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_search_combined_tsvector') THEN
        COMMENT ON INDEX idx_services_search_combined_tsvector IS 'Index full-text combiné pour recherche globale rapide';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_products_tsvector') THEN
        COMMENT ON INDEX idx_services_products_tsvector IS 'Index full-text pour recherche dans les produits';
    END IF;
END $$;
COMMENT ON FUNCTION extract_product_search_text IS 'Fonction optimisée pour extraire texte des produits pour recherche full-text';
