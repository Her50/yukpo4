-- ✅ CORRECTION 2026-02-02: Forcer la mise à jour de refresh_services_search_optimized()
-- Problème: La fonction n'a peut-être pas été mise à jour avec la création automatique de l'index
-- Solution: Recréer la fonction avec la vérification et création de l'index

-- ✅ CRITIQUE: Recréer la fonction avec la création automatique de l'index
CREATE OR REPLACE FUNCTION refresh_services_search_optimized()
RETURNS void AS $$
BEGIN
    -- ✅ OPTIMISÉ: Utiliser la vue v2 si elle existe, sinon utiliser l'ancienne
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        -- ✅ CORRECTION 2026-02-02: Créer l'index unique si nécessaire AVANT le refresh
        -- Le problème: REFRESH CONCURRENTLY nécessite un index unique sans clause WHERE
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexname = 'idx_services_search_optimized_v2_unique'
        ) THEN
            -- Créer l'index unique requis pour REFRESH CONCURRENTLY
            CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique
            ON services_search_optimized_v2 (service_id);
            
            RAISE NOTICE '✅ Index unique créé automatiquement pour services_search_optimized_v2';
        END IF;
        
        REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized_v2;
    ELSIF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized') THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_services_search_optimized() IS 
'Fonction de refresh de la vue matérialisée de recherche. Crée automatiquement l''index unique si nécessaire avant le refresh concurrent.';

