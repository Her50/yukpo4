-- Script pour corriger l'erreur de vue matérialisée PostgreSQL
-- Erreur : "cannot refresh materialized view concurrently"
-- 
-- Usage :
--   psql -h <rds-endpoint> -U yukpo_admin -d yukpomnang -f fix-postgres-materialized-view.sql

-- Option 1 : Créer un index unique si nécessaire pour permettre REFRESH CONCURRENTLY
-- Vérifier d'abord si un index unique existe déjà
DO $$
BEGIN
    -- Vérifier que la vue existe
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        -- Supprimer l'ancien index s'il existe avec une clause WHERE (non valide pour refresh concurrent)
        DROP INDEX IF EXISTS idx_services_search_optimized_v2_unique;
        DROP INDEX IF EXISTS services_search_optimized_v2_id_unique_idx;
        
        -- Créer l'index unique sur service_id (requis pour REFRESH CONCURRENTLY)
        -- Utiliser service_id car c'est la clé primaire de la table services
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexdef LIKE '%UNIQUE%'
        ) THEN
            CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique
            ON services_search_optimized_v2 (service_id);
            
            RAISE NOTICE 'Index unique créé pour permettre REFRESH CONCURRENTLY';
        ELSE
            RAISE NOTICE 'Index unique existe déjà';
        END IF;
    ELSE
        RAISE WARNING 'Vue matérialisée services_search_optimized_v2 n''existe pas encore';
    END IF;
END $$;

-- Option 2 : Refresh sans CONCURRENTLY (plus simple, mais bloque la vue pendant le refresh)
-- Décommenter si vous préférez cette approche
-- REFRESH MATERIALIZED VIEW services_search_optimized_v2;

-- Option 3 : Refresh avec CONCURRENTLY (nécessite un index unique)
-- Exécuter après avoir créé l'index unique
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        IF EXISTS (
            SELECT 1 
            FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexdef LIKE '%UNIQUE%'
        ) THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized_v2;
            RAISE NOTICE 'Vue matérialisée rafraîchie avec CONCURRENTLY';
        ELSE
            -- Fallback: refresh sans CONCURRENTLY si l'index n'existe pas
            REFRESH MATERIALIZED VIEW services_search_optimized_v2;
            RAISE NOTICE 'Vue matérialisée rafraîchie (sans CONCURRENTLY)';
        END IF;
    END IF;
END $$;

-- Vérifier l'état de la vue
SELECT 
    schemaname,
    matviewname,
    hasindexes,
    ispopulated
FROM pg_matviews 
WHERE matviewname = 'services_search_optimized_v2';

-- Vérifier les index sur la vue
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services_search_optimized_v2';

