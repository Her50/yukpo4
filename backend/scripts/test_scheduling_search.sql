-- Script de test pour la recherche avec planifications
-- Date: 2025-10-20

-- 1. Tester la fonction is_pharmacy_on_duty
SELECT 
    'Test pharmacie de garde' as test_name,
    is_pharmacy_on_duty(
        '{"type": "pharmacie", "joursGarde": "Lundi, Mercredi, Vendredi", "heuresOuverture": "08:00", "heuresFermeture": "20:00"}'::jsonb,
        NOW()
    ) as is_on_duty,
    'Pharmacie avec garde Lundi, Mercredi, Vendredi' as description;

-- 2. Tester la fonction is_medical_service_available
SELECT 
    'Test service médical disponible' as test_name,
    is_medical_service_available(
        '{"type": "hopital_clinique", "planningHebdomadaire": {"lundi": {"debut": "08:00", "fin": "18:00", "permanent": false}}, "prestationsMedicales": ["Consultation générale", "Chirurgie"]}'::jsonb,
        NOW(),
        'médecin'
    ) as is_available,
    'Hôpital avec consultation générale disponible' as description;

-- 3. Tester la recherche avec planifications
SELECT 
    'Test recherche pharmacie de garde' as test_name,
    COUNT(*) as result_count
FROM search_products_with_scheduling(
    'pharmacie de garde',
    NOW(),
    4.0,  -- lat
    9.7,  -- lng
    50.0  -- max_distance_km
);

-- 4. Tester la recherche de services médicaux
SELECT 
    'Test recherche médecin disponible' as test_name,
    COUNT(*) as result_count
FROM search_products_with_scheduling(
    'médecin disponible',
    NOW(),
    4.0,  -- lat
    9.7,  -- lng
    50.0  -- max_distance_km
);

-- 5. Vérifier la vue matérialisée des pharmacies de garde
SELECT 
    'Test vue pharmacies de garde' as test_name,
    COUNT(*) as total_pharmacies,
    COUNT(*) FILTER (WHERE is_on_duty = true) as pharmacies_on_duty
FROM pharmacies_on_duty;

-- 6. Tester le rafraîchissement de la vue matérialisée
SELECT refresh_pharmacies_on_duty();

-- 7. Vérifier les index créés
SELECT 
    'Index pharmacies' as index_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE '%pharmacy%';

SELECT 
    'Index hôpitaux' as index_name,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE '%hospital%';

-- 8. Test de performance - mesurer le temps d'exécution
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM search_products_with_scheduling(
    'pharmacie de garde',
    NOW(),
    4.0,
    9.7,
    50.0
) LIMIT 10;

-- 9. Vérifier les fonctions créées
SELECT 
    'Fonctions créées' as category,
    proname as function_name,
    proargnames as arguments
FROM pg_proc 
WHERE proname IN (
    'is_pharmacy_on_duty',
    'is_medical_service_available', 
    'search_products_with_scheduling',
    'refresh_pharmacies_on_duty'
);

-- 10. Test avec différents scénarios de recherche
SELECT 
    'Scénarios de recherche' as test_category,
    search_query,
    COUNT(*) as result_count
FROM (
    SELECT 'pharmacie de garde' as search_query
    UNION ALL SELECT 'pharmacie urgente'
    UNION ALL SELECT 'pharmacie 24h'
    UNION ALL SELECT 'médecin disponible'
    UNION ALL SELECT 'gynécologue maintenant'
    UNION ALL SELECT 'urgences ouvertes'
    UNION ALL SELECT 'cardiologue urgent'
) AS test_queries
CROSS JOIN LATERAL search_products_with_scheduling(
    test_queries.search_query,
    NOW(),
    4.0,
    9.7,
    50.0
)
GROUP BY search_query
ORDER BY result_count DESC;
