-- ✅ Script SQL Phase 1 - Vérification des comptages existants
-- Usage: psql $DATABASE_URL -f backend/scripts/verify_phase1_counts.sql

\echo '🔍 Phase 1 - Vérification des comptages existants'
\echo '=================================================='
\echo ''

-- 1. Vérifier si la table effects existe
\echo '📊 1. Vérification table effects'
\echo '---------------------------'

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'effects') THEN
        RAISE NOTICE '✅ Table effects existe';
        
        -- Compter les effets
        PERFORM 1;
    ELSE
        RAISE NOTICE '❌ Table effects n''existe pas';
    END IF;
END $$;

-- Compter les effets
SELECT 
    COUNT(*) as total_effets,
    COUNT(*) FILTER (WHERE is_premium = true) as premium_count,
    COUNT(*) FILTER (WHERE is_premium = false OR is_premium IS NULL) as free_count
FROM effects;

-- Compter par catégorie
\echo ''
\echo '   Par catégorie:'
SELECT 
    category,
    COUNT(*) as count
FROM effects
GROUP BY category
ORDER BY count DESC;

-- 2. Vérifier si la table video_templates existe
\echo ''
\echo '📊 2. Vérification table video_templates'
\echo '-----------------------------------'

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'video_templates') THEN
        RAISE NOTICE '✅ Table video_templates existe';
    ELSE
        RAISE NOTICE '❌ Table video_templates n''existe pas';
    END IF;
END $$;

-- Compter les templates
SELECT 
    COUNT(*) as total_templates,
    COUNT(*) FILTER (WHERE is_premium = true) as premium_count,
    COUNT(*) FILTER (WHERE is_premium = false OR is_premium IS NULL) as free_count
FROM video_templates;

-- Compter par industrie
\echo ''
\echo '   Par industrie:'
SELECT 
    COALESCE(industry, 'Non spécifié') as industry,
    COUNT(*) as count
FROM video_templates
GROUP BY industry
ORDER BY count DESC
LIMIT 20;

-- 3. Résumé
\echo ''
\echo '📋 Résumé'
\echo '-----------------------------'

SELECT 
    'Effets' as type,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) >= 100 THEN '✅ Objectif 100+ atteint'
        ELSE '⚠️  Objectif 100+ non atteint (manque ' || (100 - COUNT(*)) || ')'
    END as statut
FROM effects
UNION ALL
SELECT 
    'Templates' as type,
    COUNT(*) as total,
    CASE 
        WHEN COUNT(*) >= 1000 THEN '✅ Objectif 1000+ atteint'
        ELSE '⚠️  Objectif 1000+ non atteint (manque ' || (1000 - COUNT(*)) || ')'
    END as statut
FROM video_templates;

