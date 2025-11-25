-- Migration pour corriger l'erreur "index row size exceeds btree maximum"
-- Date: 2025-11-25
-- Description: Supprime l'INCLUDE (data) de l'index idx_services_search_optimized
--              car la colonne data JSONB peut être trop volumineuse (limite B-tree: 2704 bytes)
--              L'index sera recréé sans INCLUDE (data), seulement avec user_id
-- Compatible: SQLx offline mode (pas de SELECT retournant des résultats)
--
-- EXPLICATION :
-- L'index avec INCLUDE (data) était conçu pour permettre des "Index-Only Scans" (très rapides),
-- mais PostgreSQL B-tree a une limite de 2704 bytes (v4) ou 8191 bytes (v5) par ligne d'index.
-- Comme data JSONB peut dépasser cette limite (ex: 7830 bytes), l'index échoue.
--
-- ALTERNATIVE (optionnelle) : Si vous voulez quand même un index covering partiel,
-- vous pouvez créer un index séparé avec seulement les champs les plus utilisés :
--   CREATE INDEX idx_services_search_covering 
--   ON services (is_active, created_at DESC) 
--   INCLUDE (user_id, (data->>'titre_service'), (data->>'category'))
--   WHERE is_active = true;
--
-- Voir backend/EXPLICATION_INDEX_INCLUDE_DATA.md pour plus de détails.

-- 1. Supprimer l'ancien index problématique
DROP INDEX IF EXISTS idx_services_search_optimized;

-- 2. Recréer l'index sans INCLUDE (data) pour éviter l'erreur de taille
--    On garde seulement user_id dans INCLUDE car c'est un INTEGER (petit, ~4 bytes)
--    Performance : Les requêtes feront un lookup vers la table pour récupérer data
--    (10-50ms au lieu de 1-5ms, mais acceptable et sans limite de taille)
CREATE INDEX IF NOT EXISTS idx_services_search_optimized 
ON services (is_active, created_at DESC) 
INCLUDE (user_id)
WHERE is_active = true;

-- 3. Commentaire pour documenter la modification
COMMENT ON INDEX idx_services_search_optimized IS 
'Index optimisé pour recherche active (sans INCLUDE data pour éviter erreur taille B-tree). 
Performance: 10-50ms par requête (acceptable). Voir EXPLICATION_INDEX_INCLUDE_DATA.md pour détails.';

