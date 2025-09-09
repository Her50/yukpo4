-- Migration: Ajout des index de recherche native PostgreSQL intelligente
-- Date: 2025-08-30
-- Description: Index pour recherche full-text, trigram et hybride
-- Base de données: yukpo_db
-- Utilisateur: postgres

-- Se connecter à la base de données yukpo_db
\c yukpo_db;

-- 1. Extension pg_trgm pour recherche floue
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Index full-text sur les champs principaux des services
-- Combine titre_service, description, category et autres champs textuels
CREATE INDEX IF NOT EXISTS idx_services_fulltext_titre 
ON services USING gin(to_tsvector('french', data->>'titre_service'));

CREATE INDEX IF NOT EXISTS idx_services_fulltext_description 
ON services USING gin(to_tsvector('french', data->>'description'));

CREATE INDEX IF NOT EXISTS idx_services_fulltext_category 
ON services USING gin(to_tsvector('french', data->>'category'));

-- Index full-text combiné pour recherche globale
CREATE INDEX IF NOT EXISTS idx_services_fulltext_combined 
ON services USING gin(
    to_tsvector('french', 
        COALESCE(data->>'titre_service', '') || ' ' ||
        COALESCE(data->>'description', '') || ' ' ||
        COALESCE(data->>'category', '') || ' ' ||
        COALESCE(data->>'gps_fixe', '')
    )
);

-- 3. Index trigram pour recherche floue et fautes de frappe
CREATE INDEX IF NOT EXISTS idx_services_trigram_titre 
ON services USING gin((data->>'titre_service') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_trigram_description 
ON services USING gin((data->>'description') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_trigram_category 
ON services USING gin((data->>'category') gin_trgm_ops);

-- Index trigram combiné
CREATE INDEX IF NOT EXISTS idx_services_trigram_combined 
ON services USING gin(
    (COALESCE(data->>'titre_service', '') || ' ' ||
     COALESCE(data->>'description', '') || ' ' ||
     COALESCE(data->>'category', '')) gin_trgm_ops
);

-- 4. Index sur les champs structurés (format complexe avec valeur)
CREATE INDEX IF NOT EXISTS idx_services_structured_titre 
ON services USING gin(to_tsvector('french', data->'titre_service'->>'valeur'));

CREATE INDEX IF NOT EXISTS idx_services_structured_description 
ON services USING gin(to_tsvector('french', data->'description'->>'valeur'));

CREATE INDEX IF NOT EXISTS idx_services_structured_category 
ON services USING gin(to_tsvector('french', data->'category'->>'valeur'));

-- Index trigram pour les champs structurés
CREATE INDEX IF NOT EXISTS idx_services_structured_trigram_titre 
ON services USING gin((data->'titre_service'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_structured_trigram_description 
ON services USING gin((data->'description'->>'valeur') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_structured_trigram_category 
ON services USING gin((data->'category'->>'valeur') gin_trgm_ops);

-- 5. Index sur la colonne category directe (si utilisée)
CREATE INDEX IF NOT EXISTS idx_services_category_direct 
ON services USING gin(to_tsvector('french', category));

-- 6. Index sur les métadonnées importantes
CREATE INDEX IF NOT EXISTS idx_services_active_created 
ON services (is_active, created_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_services_user_active 
ON services (user_id, is_active) 
WHERE is_active = true;

-- 7. Index sur GPS pour recherche géographique
CREATE INDEX IF NOT EXISTS idx_services_gps 
ON services USING gin(to_tsvector('french', data->>'gps_fixe'));

-- 8. Index trigram sur GPS
CREATE INDEX IF NOT EXISTS idx_services_gps_trigram 
ON services USING gin((data->>'gps_fixe') gin_trgm_ops);

-- 9. Index composite pour recherche optimisée
CREATE INDEX IF NOT EXISTS idx_services_search_optimized 
ON services (is_active, created_at DESC) 
INCLUDE (data, user_id)
WHERE is_active = true;

-- 10. Index pour recherche par intention (si stockée)
CREATE INDEX IF NOT EXISTS idx_services_intention 
ON services USING gin(to_tsvector('french', data->>'intention'));

-- Vérification des index créés
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE 'idx_services_%'
ORDER BY indexname;

-- Vérification des extensions installées
SELECT 
    extname,
    extversion,
    extrelocatable
FROM pg_extension 
WHERE extname = 'pg_trgm'; 