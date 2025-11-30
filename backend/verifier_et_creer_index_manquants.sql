-- ============================================================
-- VÉRIFIER ET CRÉER LES INDEX MANQUANTS DE LA MIGRATION 20250830001
-- ============================================================

\echo '=== VÉRIFICATION : Index de la migration 20250830001 ==='

-- Vérifier quels index de la migration existent
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_fulltext_titre') 
        THEN '✅ Existe'
        ELSE '❌ MANQUANT'
    END as idx_services_fulltext_titre,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_fulltext_description') 
        THEN '✅ Existe'
        ELSE '❌ MANQUANT'
    END as idx_services_fulltext_description,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_structured_titre') 
        THEN '✅ Existe'
        ELSE '❌ MANQUANT'
    END as idx_services_structured_titre,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_structured_description') 
        THEN '✅ Existe'
        ELSE '❌ MANQUANT'
    END as idx_services_structured_description;

\echo ''
\echo '=== CRÉATION DES INDEX MANQUANTS ==='

-- Créer les index manquants de la migration 20250830001
-- (seulement ceux qui n'existent pas déjà)

-- Index full-text sur data->>'titre_service'
CREATE INDEX IF NOT EXISTS idx_services_fulltext_titre 
ON services USING gin(to_tsvector('french', data->>'titre_service'))
WHERE is_active = true;

-- Index full-text sur data->>'description'
CREATE INDEX IF NOT EXISTS idx_services_fulltext_description 
ON services USING gin(to_tsvector('french', data->>'description'))
WHERE is_active = true;

-- Index full-text sur data->'titre_service'->>'valeur'
CREATE INDEX IF NOT EXISTS idx_services_structured_titre 
ON services USING gin(to_tsvector('french', data->'titre_service'->>'valeur'))
WHERE is_active = true;

-- Index full-text sur data->'description'->>'valeur'
CREATE INDEX IF NOT EXISTS idx_services_structured_description 
ON services USING gin(to_tsvector('french', data->'description'->>'valeur'))
WHERE is_active = true;

\echo ''
\echo '=== VÉRIFICATION FINALE ==='
SELECT 
    indexname,
    CASE 
        WHEN indexname LIKE '%fulltext%' OR indexname LIKE '%structured%' 
        THEN '✅ Index de migration 20250830001'
        ELSE 'Autre index'
    END as type
FROM pg_indexes
WHERE tablename = 'services'
AND (
    indexname LIKE '%fulltext%' 
    OR indexname LIKE '%structured%'
)
ORDER BY indexname;

