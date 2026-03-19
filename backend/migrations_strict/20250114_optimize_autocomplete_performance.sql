-- Migration: Optimisation des performances autocomplete_characteristics
-- Date: 2025-01-14
-- Objectif: Réduire les temps de réponse de 3-5s à <500ms

-- ✅ 1. Index composite optimisé pour la requête principale
-- Combine les filtres les plus fréquents: is_real_product + identifiant_base + service_id
CREATE INDEX IF NOT EXISTS idx_autocomplete_real_product_composite 
ON autocomplete_characteristics(identifiant_base, is_real_product, service_id) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

-- ✅ 2. Index pour le tri par relevance_score (usage_count + service_id)
CREATE INDEX IF NOT EXISTS idx_autocomplete_relevance_sort 
ON autocomplete_characteristics(service_id, usage_count DESC) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

-- ✅ 3. Index partiel pour services actifs uniquement
CREATE INDEX IF NOT EXISTS idx_services_active_id 
ON services(id) 
WHERE is_active = TRUE;

-- ✅ 4. Index pour la jointure services -> users
CREATE INDEX IF NOT EXISTS idx_services_user_id 
ON services(user_id) 
WHERE is_active = TRUE;

-- ✅ 5. Index GIN optimisé pour full_vector avec filtre
-- Utilise l'opérateur && pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_gin_filtered 
ON autocomplete_characteristics USING GIN(full_vector) 
WHERE is_real_product = TRUE AND identifiant_base = 'produits';

-- ✅ 6. Index pour chosen_location (utilisé dans le scoring)
CREATE INDEX IF NOT EXISTS idx_autocomplete_chosen_location_filtered 
ON autocomplete_characteristics(chosen_location) 
WHERE is_real_product = TRUE AND chosen_location IS NOT NULL;

-- ✅ 7. Statistiques pour optimiseur PostgreSQL
ANALYZE autocomplete_characteristics;
ANALYZE services;
ANALYZE users;

-- ✅ 8. Configuration pour améliorer les performances
-- Augmenter work_mem temporairement pour cette session (si nécessaire)
-- Note: Les paramètres globaux doivent être configurés au niveau du serveur PostgreSQL








