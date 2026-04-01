-- Migration: Correction erreur to_tsvector avec langue dynamique
-- Date: 2026-01-14
-- Description: Corrige l'erreur to_tsvector avec langue dynamique
-- Compatible SQLx offline mode

-- Cette migration est un placeholder - la correction to_tsvector
-- est gérée dans d'autres migrations (00000052_fix_image_search_to_tsvector_error.sql)
-- Cette migration existe pour compatibilité avec auto_migrate.rs

DO $$
BEGIN
    -- Les corrections to_tsvector sont dans d'autres migrations
    -- Cette migration est un no-op pour compatibilité
    NULL;
END $$;

