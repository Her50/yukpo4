-- Script pour vérifier la version PostgreSQL et les limites B-tree
-- Exécutez ce script sur votre base Render pour connaître votre version

-- 1. Version PostgreSQL complète
SELECT 
    'Version PostgreSQL' as info,
    version() as valeur;

-- 2. Version PostgreSQL (numéro seulement)
SELECT 
    'Version PostgreSQL (numéro)' as info,
    current_setting('server_version_num')::int as version_numero,
    CASE 
        WHEN current_setting('server_version_num')::int >= 130000 THEN 'B-tree v5 (limite ~8191 bytes)'
        ELSE 'B-tree v4 (limite ~2704 bytes)'
    END as limite_btree;

-- 3. Taille de bloc (généralement 8192 bytes = 8KB)
SELECT 
    'Taille de bloc' as info,
    current_setting('block_size')::int as taille_bytes,
    pg_size_pretty(current_setting('block_size')::bigint) as taille_formatee;

-- 4. Limite théorique B-tree (environ 1/3 du bloc pour v4, presque tout pour v5)
SELECT 
    'Limite théorique B-tree' as info,
    CASE 
        WHEN current_setting('server_version_num')::int >= 130000 THEN 
            (current_setting('block_size')::int - 200)::text || ' bytes (B-tree v5)'
        ELSE 
            ((current_setting('block_size')::int / 3) - 100)::text || ' bytes (B-tree v4)'
    END as limite_estimee;

-- 5. Informations sur l'index problématique (si existant)
SELECT 
    'Index idx_services_search_optimized' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_services_search_optimized'
        ) THEN '✅ Existe'
        ELSE '❌ N''existe pas'
    END as statut;

-- 6. Définition de l'index (si existant)
SELECT 
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as taille_index
FROM pg_indexes 
WHERE indexname = 'idx_services_search_optimized';

-- 7. Taille moyenne de la colonne data (pour référence)
SELECT 
    'Taille moyenne data JSONB' as info,
    pg_size_pretty(AVG(pg_column_size(data))::bigint) as taille_moyenne,
    pg_size_pretty(MAX(pg_column_size(data))::bigint) as taille_max,
    pg_size_pretty(MIN(pg_column_size(data))::bigint) as taille_min
FROM services
WHERE data IS NOT NULL
LIMIT 1;

