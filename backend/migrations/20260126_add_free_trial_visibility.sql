-- ✅ NOUVEAU 2026-01-26: Migration pour visibilité gratuite première publication
-- Description: Ajout colonnes pour détecter première publication et offrir 1 mois gratuit

-- Ajouter colonne has_used_free_trial à real_estate_properties
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'has_used_free_trial'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN has_used_free_trial BOOLEAN DEFAULT FALSE;
        
        COMMENT ON COLUMN real_estate_properties.has_used_free_trial IS 
            'Indique si le bien a déjà utilisé son mois gratuit de première publication';
        
        RAISE NOTICE 'Colonne has_used_free_trial ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne has_used_free_trial existe déjà';
    END IF;
END $$;

-- Ajouter colonne is_first_publication à immobilier_visibility_subscriptions
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'immobilier_visibility_subscriptions' 
        AND column_name = 'is_first_publication'
    ) THEN
        ALTER TABLE immobilier_visibility_subscriptions 
        ADD COLUMN is_first_publication BOOLEAN DEFAULT FALSE;
        
        COMMENT ON COLUMN immobilier_visibility_subscriptions.is_first_publication IS 
            'Indique si cet abonnement est la première publication gratuite (30 jours)';
        
        RAISE NOTICE 'Colonne is_first_publication ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne is_first_publication existe déjà';
    END IF;
END $$;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_real_estate_free_trial 
ON real_estate_properties(has_used_free_trial) 
WHERE has_used_free_trial = FALSE;

CREATE INDEX IF NOT EXISTS idx_visibility_first_publication 
ON immobilier_visibility_subscriptions(is_first_publication) 
WHERE is_first_publication = TRUE;

