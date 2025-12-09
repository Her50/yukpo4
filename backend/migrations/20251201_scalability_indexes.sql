-- ✅ NOUVEAU 2025-12-01: Migration d'optimisation de scalabilité
-- Index et vues matérialisées pour gérer des millions d'interactions

-- =====================================================
-- 1. INDEX OPTIMISÉS POUR RECHERCHE PRODUIT
-- =====================================================

-- Index composite pour recherche produits avec filtres fréquents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_active_category_gps 
ON services (is_active, category, created_at DESC) 
WHERE is_active = TRUE;

-- Index GIN pour recherche full-text dans produits JSON
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_products_fulltext_gin
ON services USING GIN (
    to_tsvector('french', 
        COALESCE(data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(data->'description'->>'valeur', '') || ' ' ||
        COALESCE(category, '')
    )
);

-- Index GIN pour recherche dans produits (array JSONB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_products_array_gin
ON services USING GIN (
    (
        CASE 
            WHEN jsonb_typeof(data->'produits') = 'array' 
            THEN data->'produits'
            WHEN jsonb_typeof(data->'produits'->'valeur') = 'array'
            THEN data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    )
);

-- =====================================================
-- 2. INDEX OPTIMISÉS POUR LIVRAISONS
-- =====================================================

-- Index composite pour matching de livraisons fréquent (table deliveries)
-- Note: CREATE INDEX CONCURRENTLY ne peut pas être dans un DO block, donc on le fait directement
CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at_optimized
ON deliveries (status, requested_at DESC)
WHERE status IN ('requested', 'awaiting_courier_confirmation');

-- Index pour récupérer rapidement les livraisons d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_deliveries_creator_status
ON deliveries (creator_id, status, requested_at DESC);

-- Index pour recherche de coursiers disponibles (table couriers)
-- Note: CREATE INDEX CONCURRENTLY ne peut pas être dans un DO block
-- Vérifier le type d'enum pour courier status avant de créer l'index
CREATE INDEX IF NOT EXISTS idx_couriers_status_rating
ON couriers (status, rating_average DESC NULLS LAST)
WHERE status IS NOT NULL;

-- Index pour tracking points récents (performance)
-- Note: CREATE INDEX CONCURRENTLY ne peut pas être dans un DO block, et NOW() n'est pas IMMUTABLE
-- La condition de date sera gérée dans les requêtes SQL
CREATE INDEX IF NOT EXISTS idx_tracking_points_recent_delivery
ON delivery_tracking_points (delivery_id, captured_at DESC);

-- =====================================================
-- 3. INDEX OPTIMISÉS POUR GÉNÉRATION VIDÉO
-- =====================================================

-- Index pour jobs vidéo en attente/traitement
-- Note: CREATE INDEX CONCURRENTLY ne peut pas être dans un DO block
CREATE INDEX IF NOT EXISTS idx_video_jobs_status_created
ON video_generation_jobs (status, created_at)
WHERE status IN ('queued', 'processing');

-- Index pour recherche de vidéos par service_id
CREATE INDEX IF NOT EXISTS idx_video_jobs_service_status
ON video_generation_jobs (service_id, status, created_at DESC)
WHERE service_id IS NOT NULL;

-- Index pour récupérer rapidement les vidéos d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_status
ON video_generation_jobs (user_id, status, created_at DESC);

-- =====================================================
-- 4. VUES MATÉRIALISÉES POUR PERFORMANCE
-- =====================================================

-- Vue matérialisée pour recherches fréquentes (recharge toutes les 5 minutes)
CREATE MATERIALIZED VIEW IF NOT EXISTS services_search_cache AS
SELECT 
    s.id,
    s.user_id,
    s.data,
    s.is_active,
    s.category,
    s.gps,
    s.created_at,
    to_tsvector('french', 
        COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
        COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
        COALESCE(s.category, '')
    ) as search_vector
FROM services s
WHERE s.is_active = TRUE;

-- ✅ CORRECTION: Index unique requis pour REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_cache_id_unique
ON services_search_cache (id);

-- Index sur la vue matérialisée
CREATE INDEX IF NOT EXISTS idx_services_search_cache_vector
ON services_search_cache USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_services_search_cache_category
ON services_search_cache (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_services_search_cache_active
ON services_search_cache (is_active, created_at DESC)
WHERE is_active = TRUE;

-- Vue matérialisée pour produits actifs (recharge toutes les 10 minutes)
-- ✅ CORRECTION: Ajouter un identifiant unique pour chaque ligne (requis pour REFRESH CONCURRENTLY)
CREATE MATERIALIZED VIEW IF NOT EXISTS active_products_cache AS
SELECT 
    (s.id::bigint * 1000000 + jsonb_array_elements.pos) as cache_id,
    s.id as service_id,
    s.user_id,
    s.category,
    s.gps,
    jsonb_array_elements.product,
    s.created_at
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        THEN s.data->'produits'->'valeur'
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS jsonb_array_elements(product, pos)
WHERE s.is_active = TRUE
AND (
    jsonb_typeof(s.data->'produits') = 'array' OR
    jsonb_typeof(s.data->'produits'->'valeur') = 'array'
);

-- ✅ CORRECTION: Index unique requis pour REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_products_cache_id_unique
ON active_products_cache (cache_id);

-- Index sur la vue produits actifs
CREATE INDEX IF NOT EXISTS idx_active_products_service_category
ON active_products_cache (service_id, category);

CREATE INDEX IF NOT EXISTS idx_active_products_product_name
ON active_products_cache USING GIN (
    to_tsvector('french', 
        COALESCE(product->>'name', '') || ' ' ||
        COALESCE(product->>'description', '')
    )
);

-- =====================================================
-- 5. FONCTION DE RECHARGE DES VUES MATÉRIALISÉES
-- =====================================================

-- Fonction pour recharger les vues matérialisées
CREATE OR REPLACE FUNCTION refresh_scalability_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_cache;
    REFRESH MATERIALIZED VIEW CONCURRENTLY active_products_cache;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGER POUR AUTO-REFRESH (optionnel, à utiliser avec précaution)
-- =====================================================

-- Note: Les triggers automatiques peuvent impacter les performances
-- Il est recommandé de recharger via cron job ou tâche planifiée

-- =====================================================
-- 7. STATISTIQUES POUR OPTIMISEUR POSTGRESQL
-- =====================================================

-- Analyser les tables pour améliorer les plans d'exécution (si elles existent)
ANALYZE services;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
        ANALYZE deliveries;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_generation_jobs') THEN
        ANALYZE video_generation_jobs;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'couriers') THEN
        ANALYZE couriers;
    END IF;
END $$;

-- =====================================================
-- 8. INDEX POUR RECHERCHES PAR UTILISATEUR
-- =====================================================

-- Index pour récupérer rapidement les services d'un utilisateur
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_user_active_created
ON services (user_id, is_active, created_at DESC)
WHERE is_active = TRUE;

COMMENT ON MATERIALIZED VIEW services_search_cache IS 
'Vue matérialisée pour cache de recherches fréquentes. Recharger toutes les 5 minutes pour performance optimale.';

COMMENT ON MATERIALIZED VIEW active_products_cache IS 
'Vue matérialisée pour cache de produits actifs. Recharger toutes les 10 minutes pour performance optimale.';

