-- Migration: Optimisation légère des index pour la recherche services
-- Objectif: conserver uniquement les index indispensables et compatibles avec une exécution en migration SQLx.

-- Index composite sur statut/catégorie/date pour accélérer les filtres les plus courants
CREATE INDEX IF NOT EXISTS idx_services_search_composite 
ON services (is_active, category, created_at DESC)
WHERE is_active = TRUE;

-- Index full-text (tsvector) pour la recherche globale
CREATE INDEX IF NOT EXISTS idx_services_fulltext_optimized 
ON services USING GIN (
    to_tsvector(
        'french',
        COALESCE(data->>'titre_service', '') || ' ' ||
        COALESCE(data->>'description', '') || ' ' ||
        COALESCE(data->>'category', '')
    )
);

-- Index trigram pour le titre, la description et la catégorie
CREATE INDEX IF NOT EXISTS idx_services_trgm_titre 
ON services USING GIN ((data->>'titre_service') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_trgm_description 
ON services USING GIN ((data->>'description') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_trgm_category 
ON services USING GIN ((data->>'category') gin_trgm_ops);

-- Index JSONB sur les tags produits/services
CREATE INDEX IF NOT EXISTS idx_services_tags_jsonb 
ON services USING GIN ((data->'tags'));

-- Index pour la gestion des services par prestataire et statut
CREATE INDEX IF NOT EXISTS idx_services_user_status 
ON services (user_id, is_active, created_at DESC)
WHERE is_active = TRUE;

