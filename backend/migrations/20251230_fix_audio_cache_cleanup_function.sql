-- Migration: Correction fonction run_audio_cache_cleanup
-- Date: 2025-12-30
-- Description: Corrige l'erreur "record result has no field deleted_count" 
--              en changeant le retour de JSONB à TABLE avec variables explicites

-- =====================================================
-- Correction de la fonction run_audio_cache_cleanup
-- =====================================================

-- ✅ CORRIGÉ 2025-12-30: Retourne une TABLE pour correspondre au code Rust
-- Le problème était que RECORD ne permettait pas d'accéder aux champs de manière fiable
-- La solution: utiliser des variables explicites et retourner une TABLE
DROP FUNCTION IF EXISTS run_audio_cache_cleanup();

CREATE OR REPLACE FUNCTION run_audio_cache_cleanup()
RETURNS TABLE(
    deleted_count INTEGER,
    kept_count INTEGER,
    total_before INTEGER,
    total_after INTEGER
) AS $$
DECLARE
    deleted_count_var INTEGER;
    kept_count_var INTEGER;
    total_before_var INTEGER;
    total_after_var INTEGER;
BEGIN
            -- Exécuter le nettoyage et récupérer les résultats dans des variables explicites
            SELECT 
                deleted_count,
                kept_count,
                total_before,
                total_after
            INTO 
                deleted_count_var,
                kept_count_var,
                total_before_var,
                total_after_var
            FROM cleanup_old_audio_transcriptions()
            LIMIT 1;
    
    -- Log (peut être envoyé à un système de monitoring)
    RAISE NOTICE 'Audio cache cleanup: deleted %, kept %, total before %, after %', 
        deleted_count_var, kept_count_var, total_before_var, total_after_var;
    
    -- Retourner les résultats comme une table
    RETURN QUERY SELECT deleted_count_var, kept_count_var, total_before_var, total_after_var;
END;
$$ LANGUAGE plpgsql;

-- Vérification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'run_audio_cache_cleanup'
    ) THEN
        RAISE EXCEPTION 'Fonction run_audio_cache_cleanup non créée';
    END IF;
    
    RAISE NOTICE '✅ Fonction run_audio_cache_cleanup corrigée avec succès';
END $$;

