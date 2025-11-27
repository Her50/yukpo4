-- Migration: Optimiser les requêtes SQL lentes identifiées dans les logs
-- Date: 2025-11-27
-- Description: Créer des index pour améliorer les performances des requêtes >1s

-- 1. Index pour la recherche full-text sur services (requête lente identifiée)
-- Cette requête utilise ts_rank et to_tsvector sur titre_service, description, category
CREATE INDEX IF NOT EXISTS idx_services_fulltext_titre_service 
ON services USING gin(to_tsvector('french', COALESCE(data->>'titre_service', data->'titre_service'->>'valeur', '')));

CREATE INDEX IF NOT EXISTS idx_services_fulltext_description 
ON services USING gin(to_tsvector('french', COALESCE(data->>'description', data->'description'->>'valeur', '')));

CREATE INDEX IF NOT EXISTS idx_services_fulltext_category 
ON services USING gin(to_tsvector('french', COALESCE(data->>'category', data->'category'->>'valeur', category, '')));

-- 2. Index composite pour is_active + user_id (requête get_services_for_prestataire)
CREATE INDEX IF NOT EXISTS idx_services_user_active 
ON services(user_id, is_active) 
WHERE is_active = true;

-- 3. Index pour created_at (utilisé dans ORDER BY)
CREATE INDEX IF NOT EXISTS idx_services_created_at_desc 
ON services(created_at DESC);

-- 4. Index pour produits_count (si utilisé dans des requêtes)
-- Note: produits_count est calculé via jsonb_array_length, donc on indexe le JSONB directement
CREATE INDEX IF NOT EXISTS idx_services_produits_jsonb 
ON services USING gin(data->'produits') 
WHERE data->'produits' IS NOT NULL;

-- 5. Index pour gps (recherche GPS)
CREATE INDEX IF NOT EXISTS idx_services_gps 
ON services(gps) 
WHERE gps IS NOT NULL AND gps != '';

-- 6. Index pour gps_fixe dans JSONB
CREATE INDEX IF NOT EXISTS idx_services_gps_fixe_jsonb 
ON services USING gin((data->'gps_fixe')) 
WHERE data->'gps_fixe' IS NOT NULL;

-- 7. Index pour autocomplete_characteristics (recherche fréquente)
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_service_id 
ON autocomplete_characteristics(service_id) 
WHERE is_real_product = true;

CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_identifiant 
ON autocomplete_characteristics(identifiant_base) 
WHERE identifiant_base LIKE 'produit%';

-- 8. Index pour characteristic_vector (recherche vectorielle)
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_vector 
ON autocomplete_characteristics USING gin(characteristic_vector) 
WHERE characteristic_vector IS NOT NULL;

-- 9. Index pour location_vector (recherche géographique)
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_location 
ON autocomplete_characteristics USING gin(location_vector) 
WHERE location_vector IS NOT NULL;

-- 10. Index pour product_reactions (requêtes fréquentes)
CREATE INDEX IF NOT EXISTS idx_product_reactions_service_product 
ON product_reactions(service_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_reactions_user 
ON product_reactions(user_id, service_id, product_id);

-- 11. Index pour geo_hierarchy (recherche de lieux)
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place_name 
ON geo_hierarchy(place_name, parent_country);

CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_location_vector 
ON geo_hierarchy USING gin(location_vector);

-- 12. Index pour services avec filtrage actif + catégorie
CREATE INDEX IF NOT EXISTS idx_services_active_category 
ON services(is_active, category) 
WHERE is_active = true;

-- 13. Index pour améliorer les jointures avec users
CREATE INDEX IF NOT EXISTS idx_services_user_id 
ON services(user_id);

-- 14. Analyser les tables pour mettre à jour les statistiques
ANALYZE services;
ANALYZE autocomplete_characteristics;
ANALYZE product_reactions;
ANALYZE geo_hierarchy;

-- Commentaires sur les index
COMMENT ON INDEX idx_services_fulltext_titre_service IS 'Index GIN pour recherche full-text sur titre_service';
COMMENT ON INDEX idx_services_user_active IS 'Index composite pour requêtes get_services_for_prestataire';
COMMENT ON INDEX idx_autocomplete_characteristics_vector IS 'Index GIN pour recherche dans characteristic_vector';

