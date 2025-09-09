-- Migration: Optimisation des index PostgreSQL pour la performance
-- Base de données: yukpo_db
-- Utilisateur: postgres

\c yukpo_db;

-- 1. Analyse des performances actuelles
ANALYZE services;

-- 2. Index composite optimisés pour la recherche multi-critères
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_search_composite 
ON services (is_active, category, created_at DESC) 
WHERE is_active = true;

-- 3. Index pour la recherche full-text optimisée
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_fulltext_optimized 
ON services USING GIN (
    to_tsvector('french', 
        COALESCE(data->>'titre_service', '') || ' ' ||
        COALESCE(data->>'description', '') || ' ' ||
        COALESCE(data->>'category', '')
    )
);

-- 4. Index pour la recherche trigram optimisée
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_trigram_optimized 
ON services USING GIN (
    COALESCE(data->>'titre_service', '') gin_trgm_ops,
    COALESCE(data->>'description', '') gin_trgm_ops,
    COALESCE(data->>'category', '') gin_trgm_ops
);

-- 5. Index pour la recherche par date avec partition temporelle
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_date_partition 
ON services (DATE(created_at), is_active) 
WHERE is_active = true;

-- 6. Index pour la recherche par utilisateur et statut
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_user_status 
ON services (user_id, is_active, created_at DESC) 
WHERE is_active = true;

-- 7. Index pour la recherche par catégorie et localisation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_category_location 
ON services (category, gps, is_active) 
WHERE is_active = true;

-- 8. Index pour la recherche par prix (si applicable)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_price_range 
ON services ((data->>'prix')::numeric, is_active) 
WHERE is_active = true AND data->>'prix' IS NOT NULL;

-- 9. Index pour la recherche par tags/mots-clés
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_tags 
ON services USING GIN ((data->'tags') jsonb_path_ops);

-- 10. Index pour la recherche par disponibilité
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_availability 
ON services (is_active, (data->>'disponible')::boolean, created_at DESC) 
WHERE is_active = true;

-- 11. Index pour la recherche par évaluation/score
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_rating 
ON services ((data->>'note_moyenne')::numeric DESC, is_active) 
WHERE is_active = true AND data->>'note_moyenne' IS NOT NULL;

-- 12. Index pour la recherche par zone d'intervention
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_intervention_zone 
ON services USING GIN ((data->>'zone_intervention') gin_trgm_ops);

-- 13. Index pour la recherche par horaires
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_schedule 
ON services USING GIN ((data->>'horaires') gin_trgm_ops);

-- 14. Index pour la recherche par compétences
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_skills 
ON services USING GIN ((data->>'competences') gin_trgm_ops);

-- 15. Index pour la recherche par équipements
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_equipment 
ON services USING GIN ((data->>'equipements') gin_trgm_ops);

-- 16. Index pour la recherche par certifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_certifications 
ON services USING GIN ((data->>'certifications') gin_trgm_ops);

-- 17. Index pour la recherche par expérience
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_experience 
ON services ((data->>'annees_experience')::integer DESC, is_active) 
WHERE is_active = true AND data->>'annees_experience' IS NOT NULL;

-- 18. Index pour la recherche par langue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_language 
ON services USING GIN ((data->>'langues') gin_trgm_ops);

-- 19. Index pour la recherche par spécialité
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_specialty 
ON services USING GIN ((data->>'specialites') gin_trgm_ops);

-- 20. Index pour la recherche par type de service
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_service_type 
ON services ((data->>'type_service'), is_active) 
WHERE is_active = true;

-- 21. Index pour la recherche par mode de paiement
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_payment_method 
ON services USING GIN ((data->>'modes_paiement') gin_trgm_ops);

-- 22. Index pour la recherche par garantie
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_warranty 
ON services ((data->>'garantie')::boolean, is_active) 
WHERE is_active = true;

-- 23. Index pour la recherche par urgence
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_urgency 
ON services ((data->>'urgent')::boolean, created_at DESC) 
WHERE is_active = true;

-- 24. Index pour la recherche par saisonnalité
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_seasonal 
ON services ((data->>'saisonnier')::boolean, (data->>'saison') gin_trgm_ops) 
WHERE is_active = true;

-- 25. Index pour la recherche par accessibilité
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_accessibility 
ON services USING GIN ((data->>'accessibilite') gin_trgm_ops);

-- 26. Index pour la recherche par mobilité
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_mobility 
ON services ((data->>'mobile')::boolean, is_active) 
WHERE is_active = true;

-- 27. Index pour la recherche par disponibilité temporelle
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_temporal_availability 
ON services USING GIN ((data->>'disponibilite_temporelle') gin_trgm_ops);

-- 28. Index pour la recherche par zone géographique étendue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_extended_geo 
ON services USING GIN ((data->>'zones_geographiques') gin_trgm_ops);

-- 29. Index pour la recherche par niveau de service
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_service_level 
ON services ((data->>'niveau_service'), is_active) 
WHERE is_active = true;

-- 30. Index pour la recherche par statut de vérification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_verification_status 
ON services ((data->>'verifie')::boolean, (data->>'certifie')::boolean, is_active) 
WHERE is_active = true;

-- 31. Nettoyage des index obsolètes ou redondants
-- (à exécuter après vérification des performances)

-- 32. Statistiques des index créés
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND schemaname = 'public'
ORDER BY indexname;

-- 33. Analyse des performances des index
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename = 'services'
ORDER BY idx_scan DESC;

-- 34. Recommandations d'optimisation
SELECT 
    'Index recommandations:' as info,
    '1. Vérifiez que les index les plus utilisés sont en mémoire' as recommendation1,
    '2. Surveillez les index non utilisés pour suppression' as recommendation2,
    '3. Analysez régulièrement les performances avec EXPLAIN ANALYZE' as recommendation3,
    '4. Considérez le partitionnement pour les grandes tables' as recommendation4; 