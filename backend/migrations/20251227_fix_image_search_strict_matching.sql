-- Migration: Correction recherche image pour produits génériques
-- Date: 2025-12-27
-- Description: Adaptation recherche par image pour produits génériques (sans marque/couleur)
-- Compatible SQLx offline mode

-- Cette migration est un placeholder - la correction image search strict matching
-- est gérée dans d'autres migrations (00000043_fix_image_search_strict_matching.sql)
-- Cette migration existe pour compatibilité avec auto_migrate.rs

DO $$
BEGIN
    -- Les corrections image search strict matching sont dans d'autres migrations
    -- Cette migration est un no-op pour compatibilité
    NULL;
END $$;

