-- Script pour corriger l'erreur de vue matérialisée PostgreSQL
-- Erreur : "cannot refresh materialized view concurrently"
-- 
-- Usage :
--   psql -h <rds-endpoint> -U yukpo_admin -d yukpomnang -f fix-postgres-materialized-view.sql

-- Option 1 : Créer un index unique si nécessaire pour permettre REFRESH CONCURRENTLY
-- Vérifier d'abord si un index unique existe déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'services_search_optimized_v2' 
        AND indexdef LIKE '%UNIQUE%'
    ) THEN
        -- Créer un index unique sur la colonne id (ou une autre colonne unique)
        -- Ajustez selon votre schéma
        CREATE UNIQUE INDEX IF NOT EXISTS services_search_optimized_v2_id_unique_idx 
        ON services_search_optimized_v2 (id);
        
        RAISE NOTICE 'Index unique créé pour permettre REFRESH CONCURRENTLY';
    ELSE
        RAISE NOTICE 'Index unique existe déjà';
    END IF;
END $$;

-- Option 2 : Refresh sans CONCURRENTLY (plus simple, mais bloque la vue pendant le refresh)
-- Décommenter si vous préférez cette approche
-- REFRESH MATERIALIZED VIEW services_search_optimized_v2;

-- Option 3 : Refresh avec CONCURRENTLY (nécessite un index unique)
-- Décommenter après avoir créé l'index unique
-- REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized_v2;

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

