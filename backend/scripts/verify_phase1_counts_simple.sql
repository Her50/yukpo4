-- ✅ Script SQL Phase 1 - Vérification des comptages (version simplifiée sans \echo)
-- Usage: psql $DATABASE_URL -f backend/scripts/verify_phase1_counts_simple.sql

-- 1. Compter les effets
SELECT 
    'Effets' as type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_premium = true) as premium_count,
    COUNT(*) FILTER (WHERE is_premium = false OR is_premium IS NULL) as free_count,
    CASE 
        WHEN COUNT(*) >= 100 THEN '✅ Objectif 100+ atteint'
        ELSE '⚠️  Objectif 100+ non atteint (manque ' || (100 - COUNT(*)) || ')'
    END as statut
FROM effects;

-- Compter par catégorie
SELECT 
    'Effets par catégorie' as info,
    category,
    COUNT(*) as count
FROM effects
GROUP BY category
ORDER BY count DESC;

-- 2. Compter les templates
SELECT 
    'Templates' as type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_premium = true) as premium_count,
    COUNT(*) FILTER (WHERE is_premium = false OR is_premium IS NULL) as free_count,
    CASE 
        WHEN COUNT(*) >= 1000 THEN '✅ Objectif 1000+ atteint'
        ELSE '⚠️  Objectif 1000+ non atteint (manque ' || (1000 - COUNT(*)) || ')'
    END as statut
FROM video_templates;

-- Compter par industrie
SELECT 
    'Templates par industrie' as info,
    COALESCE(industry, 'Non spécifié') as industry,
    COUNT(*) as count
FROM video_templates
GROUP BY industry
ORDER BY count DESC
LIMIT 20;

