-- ✅ Script SQL de test pour vérifier les données (Phases 1.2 et 1.4)

-- Test Phase 1.2: Effets
\echo '🧪 Tests Base de Données - Phase 1.2: Effets'
\echo '=========================================='

-- Test 1: Nombre total d'effets
SELECT 
    COUNT(*) as total_effects,
    CASE 
        WHEN COUNT(*) = 49 THEN '✅ SUCCÈS: 49 effets trouvés'
        ELSE '❌ ÉCHEC: Attendu 49, obtenu ' || COUNT(*)::text
    END as resultat
FROM effects;

-- Test 2: Distribution par catégorie
SELECT 
    category,
    COUNT(*) as count,
    CASE 
        WHEN category = 'transitions' AND COUNT(*) >= 15 THEN '✅ OK'
        WHEN category = 'visual_effects' AND COUNT(*) >= 20 THEN '✅ OK'
        WHEN category = 'animations' AND COUNT(*) >= 9 THEN '✅ OK'
        WHEN category = 'special' AND COUNT(*) >= 5 THEN '✅ OK'
        ELSE '⚠️ Vérifier'
    END as status
FROM effects
GROUP BY category
ORDER BY category;

-- Test 3: Vérification index
EXPLAIN ANALYZE
SELECT * FROM effects 
WHERE category = 'transitions' 
ORDER BY popularity_score DESC 
LIMIT 10;

-- Test Phase 1.4: Templates
\echo ''
\echo '🧪 Tests Base de Données - Phase 1.4: Templates'
\echo '==============================================='

-- Test 1: Nombre total de templates
SELECT 
    COUNT(*) as total_templates,
    CASE 
        WHEN COUNT(*) = 50 THEN '✅ SUCCÈS: 50 templates trouvés'
        ELSE '❌ ÉCHEC: Attendu 50, obtenu ' || COUNT(*)::text
    END as resultat
FROM video_templates;

-- Test 2: Distribution par industrie
SELECT 
    industry,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 10 THEN '✅ OK (10 templates)'
        ELSE '⚠️ Vérifier: ' || COUNT(*)::text || ' templates'
    END as status
FROM video_templates
GROUP BY industry
ORDER BY industry;

-- Test 3: Vérification index
EXPLAIN ANALYZE
SELECT * FROM video_templates 
WHERE industry = 'ecommerce' 
ORDER BY popularity_score DESC 
LIMIT 10;

-- Test 4: Vérification formats valides
SELECT 
    format,
    COUNT(*) as count
FROM video_templates
GROUP BY format
ORDER BY format;

-- Résumé final
\echo ''
\echo '📊 Résumé des Tests'
\echo '==================='
SELECT 
    'Effects' as table_name,
    COUNT(*) as total_rows
FROM effects
UNION ALL
SELECT 
    'Templates' as table_name,
    COUNT(*) as total_rows
FROM video_templates;

