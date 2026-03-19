-- Migration de correction des problèmes critiques identifiés sur AWS
-- Date: 2026-01-30
-- Description: Corrige les problèmes identifiés dans les logs d'erreur PostgreSQL

-- ============================================================================
-- 1. CORRECTION: Supprimer les versions dupliquées de hybrid_image_search
-- ============================================================================

-- Supprimer toutes les versions existantes (on les recréera ensuite via les migrations)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'hybrid_image_search'
        AND n.nspname = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', 
                func_record.proname, 
                func_record.args);
            RAISE NOTICE 'Supprimé: hybrid_image_search(%)', func_record.args;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erreur lors de la suppression de hybrid_image_search(%): %', 
                func_record.args, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- 2. CORRECTION: Vérifier et créer specialized_reservations si manquante
-- ============================================================================

-- La table devrait être créée par la migration 20250128_001_add_specialized_reservations_and_ratings.sql
-- Si elle n'existe pas, on la crée ici
CREATE TABLE IF NOT EXISTS specialized_reservations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reservation_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_date TIMESTAMP WITH TIME ZONE,
    confirmed_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    details JSONB NOT NULL DEFAULT '{}',
    amount NUMERIC(10, 2),
    currency VARCHAR(10),
    payment_status VARCHAR(20),
    payment_method VARCHAR(50),
    notes TEXT,
    prestataire_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Créer les index si ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_id ON specialized_reservations(service_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_user_id ON specialized_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_prestataire_id ON specialized_reservations(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_status ON specialized_reservations(status);
CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_type ON specialized_reservations(service_type);

-- ============================================================================
-- 3. CORRECTION: Créer la fonction run_audio_cache_cleanup() si manquante
-- ============================================================================

-- La fonction devrait être créée par la migration 20251231_fix_audio_cache_cleanup_null_handling.sql
-- Si elle n'existe pas, on la crée ici
CREATE OR REPLACE FUNCTION run_audio_cache_cleanup()
RETURNS TABLE(
    deleted_count INTEGER,
    kept_count INTEGER,
    total_before INTEGER,
    total_after INTEGER
) AS $$
DECLARE
    deleted_count_var INTEGER := 0;
    kept_count_var INTEGER := 0;
    total_before_var INTEGER := 0;
    total_after_var INTEGER := 0;
BEGIN
    -- Vérifier si la fonction cleanup_old_audio_transcriptions existe
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'cleanup_old_audio_transcriptions'
    ) THEN
        -- Exécuter le nettoyage et récupérer les résultats dans des variables explicites
        -- Utiliser COALESCE pour garantir des valeurs non-NULL
        SELECT 
            COALESCE(deleted_count, 0),
            COALESCE(kept_count, 0),
            COALESCE(total_before, 0),
            COALESCE(total_after, 0)
        INTO 
            deleted_count_var,
            kept_count_var,
            total_before_var,
            total_after_var
        FROM cleanup_old_audio_transcriptions()
        LIMIT 1;
    ELSE
        -- Si la fonction n'existe pas, retourner des valeurs par défaut (0)
        RAISE NOTICE 'Fonction cleanup_old_audio_transcriptions non trouvée, retour de valeurs par défaut';
    END IF;
    
    -- Log (peut être envoyé à un système de monitoring)
    RAISE NOTICE 'Audio cache cleanup: deleted %, kept %, total before %, after %', 
        deleted_count_var, kept_count_var, total_before_var, total_after_var;
    
    -- Retourner les résultats comme une table (toujours des valeurs non-NULL)
    RETURN QUERY SELECT deleted_count_var, kept_count_var, total_before_var, total_after_var;
END;
$$ LANGUAGE plpgsql;

