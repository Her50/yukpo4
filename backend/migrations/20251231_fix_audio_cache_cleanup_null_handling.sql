-- Migration: Correction gestion NULL dans run_audio_cache_cleanup
-- Date: 2025-12-31
-- Description: Corrige l'erreur UnexpectedNullError en gérant les valeurs NULL
--              et en vérifiant l'existence de cleanup_old_audio_transcriptions

-- =====================================================
-- Correction de la fonction run_audio_cache_cleanup pour gérer les NULL
-- =====================================================

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

-- Vérification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'run_audio_cache_cleanup'
    ) THEN
        RAISE EXCEPTION 'Fonction run_audio_cache_cleanup non créée';
    END IF;
    
    RAISE NOTICE '✅ Fonction run_audio_cache_cleanup corrigée avec gestion NULL';
END $$;


