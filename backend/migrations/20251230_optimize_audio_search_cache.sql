-- Migration: Optimisation Recherche Audio avec Cache et Post-traitement
-- Date: 2025-12-30
-- Description: Ajoute cache de transcriptions audio et post-traitement des erreurs

-- =====================================================
-- 1. Table Cache de Transcriptions Audio
-- =====================================================

CREATE TABLE IF NOT EXISTS audio_transcription_cache (
    id SERIAL PRIMARY KEY,
    audio_hash TEXT NOT NULL UNIQUE,
    transcribed_text TEXT NOT NULL,
    language TEXT,
    confidence FLOAT,
    duration FLOAT,
    model_used VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1
);

-- Index pour recherche rapide par hash
CREATE INDEX IF NOT EXISTS idx_audio_transcription_cache_hash 
ON audio_transcription_cache (audio_hash);

-- Index pour nettoyage automatique (supprimer anciennes entrées)
CREATE INDEX IF NOT EXISTS idx_audio_transcription_cache_created_at 
ON audio_transcription_cache (created_at);

-- =====================================================
-- 2. Fonction de Correction d'Erreurs de Transcription
-- =====================================================

-- Dictionnaire de corrections communes pour produits
CREATE OR REPLACE FUNCTION correct_transcription_errors(text_input TEXT)
RETURNS TEXT AS $$
DECLARE
    corrected_text TEXT;
BEGIN
    corrected_text := text_input;
    
    -- ✅ ENRICHI 2025-12-30: Corrections communes de transcription audio
    -- Format: "erreur" → "correction"
    
    -- Vêtements
    corrected_text := REPLACE(corrected_text, 'vestte', 'veste');
    corrected_text := REPLACE(corrected_text, 'vest', 'veste');
    corrected_text := REPLACE(corrected_text, 'cuire', 'cuir');
    corrected_text := REPLACE(corrected_text, 'pantalon', 'pantalon');
    corrected_text := REPLACE(corrected_text, 'pantalons', 'pantalon');
    corrected_text := REPLACE(corrected_text, 'chemise', 'chemise');
    corrected_text := REPLACE(corrected_text, 'chemises', 'chemise');
    corrected_text := REPLACE(corrected_text, 't-shirt', 't-shirt');
    corrected_text := REPLACE(corrected_text, 'tshirt', 't-shirt');
    corrected_text := REPLACE(corrected_text, 'robe', 'robe');
    corrected_text := REPLACE(corrected_text, 'robes', 'robe');
    
    -- Chaussures
    corrected_text := REPLACE(corrected_text, 'chaussures', 'chaussure');
    corrected_text := REPLACE(corrected_text, 'baskets', 'baskets');
    corrected_text := REPLACE(corrected_text, 'basket', 'baskets');
    corrected_text := REPLACE(corrected_text, 'sandale', 'sandale');
    corrected_text := REPLACE(corrected_text, 'sandales', 'sandale');
    corrected_text := REPLACE(corrected_text, 'bottes', 'botte');
    corrected_text := REPLACE(corrected_text, 'botte', 'botte');
    
    -- Électronique
    corrected_text := REPLACE(corrected_text, 'telephone', 'téléphone');
    corrected_text := REPLACE(corrected_text, 'telephonne', 'téléphone');
    corrected_text := REPLACE(corrected_text, 'telephonne', 'téléphone');
    corrected_text := REPLACE(corrected_text, 'portable', 'téléphone');
    corrected_text := REPLACE(corrected_text, 'smartphone', 'téléphone');
    corrected_text := REPLACE(corrected_text, 'ordinateurs', 'ordinateur');
    corrected_text := REPLACE(corrected_text, 'laptop', 'ordinateur');
    corrected_text := REPLACE(corrected_text, 'pc', 'ordinateur');
    corrected_text := REPLACE(corrected_text, 'tablette', 'tablette');
    corrected_text := REPLACE(corrected_text, 'tablettes', 'tablette');
    
    -- Véhicules
    corrected_text := REPLACE(corrected_text, 'voitures', 'voiture');
    corrected_text := REPLACE(corrected_text, 'moto', 'moto');
    corrected_text := REPLACE(corrected_text, 'motos', 'moto');
    corrected_text := REPLACE(corrected_text, 'velo', 'vélo');
    corrected_text := REPLACE(corrected_text, 'velos', 'vélo');
    corrected_text := REPLACE(corrected_text, 'bicyclette', 'vélo');
    
    -- Immobilier
    corrected_text := REPLACE(corrected_text, 'maisons', 'maison');
    corrected_text := REPLACE(corrected_text, 'appartements', 'appartement');
    corrected_text := REPLACE(corrected_text, 'appart', 'appartement');
    corrected_text := REPLACE(corrected_text, 'studio', 'studio');
    corrected_text := REPLACE(corrected_text, 'studios', 'studio');
    corrected_text := REPLACE(corrected_text, 'villa', 'villa');
    corrected_text := REPLACE(corrected_text, 'villas', 'villa');
    
    -- Mobilier
    corrected_text := REPLACE(corrected_text, 'canape', 'canapé');
    corrected_text := REPLACE(corrected_text, 'canapes', 'canapé');
    corrected_text := REPLACE(corrected_text, 'table', 'table');
    corrected_text := REPLACE(corrected_text, 'tables', 'table');
    corrected_text := REPLACE(corrected_text, 'chaise', 'chaise');
    corrected_text := REPLACE(corrected_text, 'chaises', 'chaise');
    corrected_text := REPLACE(corrected_text, 'lit', 'lit');
    corrected_text := REPLACE(corrected_text, 'lits', 'lit');
    
    -- Électroménager
    corrected_text := REPLACE(corrected_text, 'frigo', 'réfrigérateur');
    corrected_text := REPLACE(corrected_text, 'refrigerateur', 'réfrigérateur');
    corrected_text := REPLACE(corrected_text, 'cuisiniere', 'cuisinière');
    corrected_text := REPLACE(corrected_text, 'micro-onde', 'micro-ondes');
    corrected_text := REPLACE(corrected_text, 'machine a laver', 'machine à laver');
    
    -- Aliments
    corrected_text := REPLACE(corrected_text, 'riz', 'riz');
    corrected_text := REPLACE(corrected_text, 'huile', 'huile');
    corrected_text := REPLACE(corrected_text, 'sucre', 'sucre');
    corrected_text := REPLACE(corrected_text, 'farine', 'farine');
    corrected_text := REPLACE(corrected_text, 'pate', 'pâte');
    corrected_text := REPLACE(corrected_text, 'pates', 'pâte');
    
    -- Coiffure/Beauté
    corrected_text := REPLACE(corrected_text, 'meche', 'mèche');
    corrected_text := REPLACE(corrected_text, 'meches', 'mèche');
    corrected_text := REPLACE(corrected_text, 'perruque', 'perruque');
    corrected_text := REPLACE(corrected_text, 'perruques', 'perruque');
    corrected_text := REPLACE(corrected_text, 'tissage', 'tissage');
    corrected_text := REPLACE(corrected_text, 'tissages', 'tissage');
    
    -- Normaliser pluriels communs et espaces
    corrected_text := REGEXP_REPLACE(corrected_text, '\s+', ' ', 'g');  -- Espaces multiples
    corrected_text := TRIM(corrected_text);
    
    RETURN corrected_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. Fonction pour Obtenir/Créer Transcription
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_transcription(
    audio_hash_param TEXT,
    transcribed_text_param TEXT,
    language_param TEXT DEFAULT NULL,
    confidence_param FLOAT DEFAULT NULL,
    duration_param FLOAT DEFAULT NULL,
    model_used_param VARCHAR(100) DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    cached_text TEXT;
BEGIN
    -- Chercher dans le cache
    SELECT transcribed_text INTO cached_text
    FROM audio_transcription_cache
    WHERE audio_hash = audio_hash_param;
    
    IF cached_text IS NOT NULL THEN
        -- Mettre à jour last_used_at et usage_count
        UPDATE audio_transcription_cache
        SET last_used_at = NOW(),
            usage_count = usage_count + 1
        WHERE audio_hash = audio_hash_param;
        
        -- Appliquer corrections
        RETURN correct_transcription_errors(cached_text);
    ELSE
        -- Nouvelle transcription : sauvegarder dans cache
        INSERT INTO audio_transcription_cache (
            audio_hash,
            transcribed_text,
            language,
            confidence,
            duration,
            model_used
        ) VALUES (
            audio_hash_param,
            transcribed_text_param,
            language_param,
            confidence_param,
            duration_param,
            model_used_param
        )
        ON CONFLICT (audio_hash) DO UPDATE SET
            last_used_at = NOW(),
            usage_count = audio_transcription_cache.usage_count + 1;
        
        -- Appliquer corrections
        RETURN correct_transcription_errors(transcribed_text_param);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Fonction de Nettoyage Automatique (Cron Job)
-- =====================================================

-- ✅ AMÉLIORÉ 2025-12-30: Nettoyage automatique avec statistiques
CREATE OR REPLACE FUNCTION cleanup_old_audio_transcriptions()
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
    -- Compter avant nettoyage
    SELECT COUNT(*) INTO total_before_var FROM audio_transcription_cache;
    
    -- Supprimer les entrées anciennes et peu utilisées
    DELETE FROM audio_transcription_cache
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND usage_count < 5;  -- Garder les entrées fréquemment utilisées
    
    GET DIAGNOSTICS deleted_count_var = ROW_COUNT;
    
    -- Compter après nettoyage
    SELECT COUNT(*) INTO total_after_var FROM audio_transcription_cache;
    
    -- Compter les entrées gardées
    kept_count_var := total_before_var - deleted_count_var;
    
    RETURN QUERY SELECT deleted_count_var, kept_count_var, total_before_var, total_after_var;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Fonction pour Cron Job (Appelée périodiquement)
-- =====================================================

-- ✅ NOUVEAU 2025-12-30: Fonction wrapper pour cron job avec logging
CREATE OR REPLACE FUNCTION run_audio_cache_cleanup()
RETURNS JSONB AS $$
DECLARE
    result RECORD;
    cleanup_result JSONB;
BEGIN
    -- Exécuter le nettoyage
    SELECT * INTO result FROM cleanup_old_audio_transcriptions();
    
    -- Construire résultat JSON
    cleanup_result := jsonb_build_object(
        'deleted_count', result.deleted_count,
        'kept_count', result.kept_count,
        'total_before', result.total_before,
        'total_after', result.total_after,
        'timestamp', NOW(),
        'success', true
    );
    
    -- Log (peut être envoyé à un système de monitoring)
    RAISE NOTICE 'Audio cache cleanup: deleted %, kept %, total before %, after %', 
        result.deleted_count, result.kept_count, result.total_before, result.total_after;
    
    RETURN cleanup_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Commentaires
-- =====================================================

COMMENT ON TABLE audio_transcription_cache IS 'Cache des transcriptions audio pour éviter re-transcription';
COMMENT ON FUNCTION correct_transcription_errors IS 'Corrige les erreurs communes de transcription audio';
COMMENT ON FUNCTION get_or_create_transcription IS 'Récupère transcription depuis cache ou crée nouvelle entrée';
COMMENT ON FUNCTION cleanup_old_audio_transcriptions IS 'Nettoie les anciennes transcriptions non utilisées';

-- =====================================================
-- 6. Vérification
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'audio_transcription_cache'
    ) THEN
        RAISE EXCEPTION 'Table audio_transcription_cache non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'correct_transcription_errors'
    ) THEN
        RAISE EXCEPTION 'Fonction correct_transcription_errors non créée';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_or_create_transcription'
    ) THEN
        RAISE EXCEPTION 'Fonction get_or_create_transcription non créée';
    END IF;
    
    RAISE NOTICE '✅ Migration recherche audio optimisée appliquée avec succès';
END $$;

