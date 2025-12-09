-- ✅ CORRECTION 2025-12-09: Ajouter index uniques requis pour REFRESH MATERIALIZED VIEW CONCURRENTLY
-- Problème: Les vues matérialisées ne peuvent pas être rafraîchies en mode concurrent sans index unique
-- Solution: Ajouter des index uniques sur les vues matérialisées
-- Compatible: SQLx offline mode (utilise sqlx::query() non typé)

-- =====================================================
-- 1. services_search_cache
-- =====================================================

-- Vérifier si la vue existe et ajouter l'index unique si nécessaire
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_cache') THEN
        -- Vérifier si l'index unique existe déjà
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_cache' 
            AND indexname = 'idx_services_search_cache_id_unique'
        ) THEN
            CREATE UNIQUE INDEX idx_services_search_cache_id_unique
            ON services_search_cache (id);
            RAISE NOTICE 'Index unique créé sur services_search_cache';
        ELSE
            RAISE NOTICE 'Index unique déjà présent sur services_search_cache';
        END IF;
    ELSE
        RAISE NOTICE 'Vue services_search_cache n''existe pas encore';
    END IF;
END $$;

-- =====================================================
-- 2. active_products_cache
-- =====================================================

-- Vérifier si la vue existe et recréer avec cache_id si nécessaire
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'active_products_cache') THEN
        -- Vérifier si la colonne cache_id existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'active_products_cache' 
            AND column_name = 'cache_id'
        ) THEN
            -- Recréer la vue avec cache_id
            DROP MATERIALIZED VIEW IF EXISTS active_products_cache CASCADE;
            
            CREATE MATERIALIZED VIEW active_products_cache AS
            SELECT 
                (s.id::bigint * 1000000 + jsonb_array_elements.pos) as cache_id,
                s.id as service_id,
                s.user_id,
                s.category,
                s.gps,
                jsonb_array_elements.product,
                s.created_at
            FROM services s
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                    WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END
            ) WITH ORDINALITY AS jsonb_array_elements(product, pos)
            WHERE s.is_active = TRUE
            AND (
                jsonb_typeof(s.data->'produits') = 'array' OR
                jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            );
            
            -- Recréer les index
            CREATE UNIQUE INDEX idx_active_products_cache_id_unique
            ON active_products_cache (cache_id);
            
            CREATE INDEX IF NOT EXISTS idx_active_products_service_category
            ON active_products_cache (service_id, category);
            
            CREATE INDEX IF NOT EXISTS idx_active_products_product_name
            ON active_products_cache USING GIN (
                to_tsvector('french', 
                    COALESCE(product->>'name', '') || ' ' ||
                    COALESCE(product->>'description', '')
                )
            );
            
            RAISE NOTICE 'Vue active_products_cache recréée avec cache_id';
        ELSE
            -- La colonne existe déjà, juste créer l'index unique si nécessaire
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = 'active_products_cache' 
                AND indexname = 'idx_active_products_cache_id_unique'
            ) THEN
                CREATE UNIQUE INDEX idx_active_products_cache_id_unique
                ON active_products_cache (cache_id);
                RAISE NOTICE 'Index unique créé sur active_products_cache';
            ELSE
                RAISE NOTICE 'Index unique déjà présent sur active_products_cache';
            END IF;
        END IF;
    ELSE
        RAISE NOTICE 'Vue active_products_cache n''existe pas encore';
    END IF;
END $$;

-- =====================================================
-- 3. global_promo_catalog_cache (vérifier si index unique existe)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'global_promo_catalog_cache') THEN
        -- Vérifier si l'index unique existe déjà
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'global_promo_catalog_cache' 
            AND indexname = 'idx_global_promo_catalog_cache_entry_id'
        ) THEN
            -- Créer l'index unique si la colonne entry_id existe
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'global_promo_catalog_cache' 
                AND column_name = 'entry_id'
            ) THEN
                CREATE UNIQUE INDEX idx_global_promo_catalog_cache_entry_id
                ON global_promo_catalog_cache(entry_id);
                RAISE NOTICE 'Index unique créé sur global_promo_catalog_cache';
            ELSE
                RAISE NOTICE 'Colonne entry_id manquante dans global_promo_catalog_cache';
            END IF;
        ELSE
            RAISE NOTICE 'Index unique déjà présent sur global_promo_catalog_cache';
        END IF;
    ELSE
        RAISE NOTICE 'Vue global_promo_catalog_cache n''existe pas encore';
    END IF;
END $$;

