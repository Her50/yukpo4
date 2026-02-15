-- ✅ CORRECTION 2026-02-02: Corriger l'index unique de la vue matérialisée
-- Problème: Erreur "cannot refresh materialized view concurrently" car l'index unique n'existe pas ou n'est pas correct
-- Solution: S'assurer que l'index unique existe bien sans clause WHERE, UNIQUEMENT si la vue existe

-- ✅ CRITIQUE: Créer l'index unique UNIQUEMENT si la vue matérialisée existe
DO $$
BEGIN
    -- Vérifier que la vue existe avant de créer l'index
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        -- Supprimer l'ancien index s'il existe (au cas où il aurait une clause WHERE)
        DROP INDEX IF EXISTS idx_services_search_optimized_v2_unique;
        
        -- Créer l'index unique requis pour REFRESH CONCURRENTLY
        -- IMPORTANT: L'index unique doit être créé SANS clause WHERE pour permettre le refresh concurrent
        CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique
        ON services_search_optimized_v2 (service_id);
        
        RAISE NOTICE '✅ Index unique créé pour services_search_optimized_v2 - REFRESH CONCURRENTLY devrait maintenant fonctionner';
    ELSE
        RAISE WARNING '⚠️ Vue matérialisée services_search_optimized_v2 n''existe pas encore - index non créé';
    END IF;
END $$;

-- Commentaire sur l'index (uniquement si l'index existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_services_search_optimized_v2_unique'
    ) THEN
        COMMENT ON INDEX idx_services_search_optimized_v2_unique IS 
        'Index unique requis pour permettre REFRESH MATERIALIZED VIEW CONCURRENTLY sur services_search_optimized_v2';
    END IF;
END $$;

