-- Migration: Correction des fonctions de visibilité
-- Date: 2025-11-01
-- Description: Correction du bug dans get_eligible_organic_products (status vs is_active)

-- ✅ Corriger la fonction pour obtenir les produits organiques éligibles
CREATE OR REPLACE FUNCTION get_eligible_organic_products(
    p_user_id INTEGER,
    p_session_id VARCHAR(100),
    p_categories TEXT[],
    p_limit INTEGER DEFAULT 15
) RETURNS TABLE (
    product_id TEXT,
    product_data JSONB,
    relevance_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH product_scores AS (
        SELECT 
            s.id::TEXT as pid,
            jsonb_build_object(
                'id', s.id,
                'service_id', s.id,
                'titre', COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre', 'Service'),
                'nom', COALESCE(s.data->'titre_service'->>'valeur', s.data->>'titre', 'Service'),
                'description', COALESCE(s.data->'description'->>'valeur', s.data->>'description', ''),
                'prix', COALESCE(s.data->'prix'->>'valeur', '0'),
                'devise', COALESCE(s.data->'devise'->>'valeur', 'XAF'),
                'produits', s.data->'produits',
                'images', CASE 
                    WHEN s.data->'base64_image' IS NOT NULL THEN jsonb_build_array(s.data->'base64_image')
                    WHEN s.data->'images' IS NOT NULL THEN s.data->'images'
                    ELSE '[]'::jsonb
                END,
                'videos', CASE 
                    WHEN s.data->'video_base64' IS NOT NULL THEN jsonb_build_array(s.data->'video_base64')
                    WHEN s.data->'videos' IS NOT NULL THEN s.data->'videos'
                    ELSE '[]'::jsonb
                END,
                'created_at', s.created_at,
                'category', s.category
            ) as pdata,
            (
                -- Score de pertinence
                CASE WHEN s.category = ANY(p_categories) THEN 10 ELSE 0 END +
                CASE WHEN s.data->>'en_promotion' = 'true' THEN 5 ELSE 0 END +
                CASE WHEN s.created_at > NOW() - INTERVAL '7 days' THEN 3 ELSE 0 END +
                CASE WHEN (s.data->>'rating')::DECIMAL >= 4.0 THEN 2 ELSE 0 END
            )::DECIMAL as score
        FROM services s
        WHERE s.is_active = true  -- ✅ CORRECTION: Utiliser is_active au lieu de status
        -- ✅ Ne pas vérifier can_show_content si pas d'historique (première visite)
        AND (
            p_user_id = 0 
            OR can_show_content(p_user_id, s.id::TEXT, 'organic', p_session_id)
        )
    )
    SELECT pid, pdata, score
    FROM product_scores
    ORDER BY score DESC, pid DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ✅ Ajouter des colonnes manquantes à la table publicites si elles n'existent pas
DO $$ 
BEGIN
    -- boost_level
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'publicites' AND column_name = 'boost_level'
    ) THEN
        ALTER TABLE publicites ADD COLUMN boost_level VARCHAR(20) DEFAULT 'basic' CHECK (boost_level IN ('basic', 'premium', 'ultra'));
    END IF;

    -- frequency_ratio
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'publicites' AND column_name = 'frequency_ratio'
    ) THEN
        ALTER TABLE publicites ADD COLUMN frequency_ratio INTEGER DEFAULT 3;
    END IF;

    -- cooldown_minutes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'publicites' AND column_name = 'cooldown_minutes'
    ) THEN
        ALTER TABLE publicites ADD COLUMN cooldown_minutes INTEGER DEFAULT 30;
    END IF;

    -- max_appearances_per_session
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'publicites' AND column_name = 'max_appearances_per_session'
    ) THEN
        ALTER TABLE publicites ADD COLUMN max_appearances_per_session INTEGER DEFAULT 3;
    END IF;

    -- impressions (pour tracking)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'publicites' AND column_name = 'impressions'
    ) THEN
        ALTER TABLE publicites ADD COLUMN impressions INTEGER DEFAULT 0;
    END IF;
END $$;

-- ✅ Mettre à jour les valeurs par défaut selon le boost_level
UPDATE publicites SET 
    frequency_ratio = CASE boost_level
        WHEN 'ultra' THEN 1
        WHEN 'premium' THEN 2
        WHEN 'basic' THEN 3
        ELSE 3
    END,
    cooldown_minutes = CASE boost_level
        WHEN 'ultra' THEN 5
        WHEN 'premium' THEN 15
        WHEN 'basic' THEN 30
        ELSE 30
    END,
    max_appearances_per_session = CASE boost_level
        WHEN 'ultra' THEN 10
        WHEN 'premium' THEN 5
        WHEN 'basic' THEN 3
        ELSE 3
    END
WHERE boost_level IS NOT NULL;

-- ✅ Commentaire
COMMENT ON FUNCTION get_eligible_organic_products IS 
'Retourne les produits organiques éligibles avec score de pertinence - CORRIGÉ pour utiliser is_active';


