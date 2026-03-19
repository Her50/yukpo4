-- ✅ NOUVEAU 2026-02-06: Migration pour phase de lancement (3 mois gratuits)
-- Permet aux prestataires de créer et réactiver des produits gratuitement pendant 3 mois

-- =====================================================
-- 1. AJOUTER COLONNE free_product_created DANS users
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'free_product_created'
    ) THEN
        ALTER TABLE users ADD COLUMN free_product_created INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Colonne free_product_created ajoutée à users';
    ELSE
        RAISE NOTICE '⚠️ Colonne free_product_created existe déjà';
    END IF;
END $$;

-- =====================================================
-- 2. CRÉER TABLE DE CONFIGURATION PHASE DE LANCEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS launch_phase_config (
    id SERIAL PRIMARY KEY,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer la configuration par défaut (3 mois à partir de maintenant)
INSERT INTO launch_phase_config (start_date, end_date, is_active, description)
VALUES (
    NOW(),
    NOW() + INTERVAL '90 days',
    TRUE,
    'Phase de lancement - 3 mois gratuits pour tous les prestataires'
)
ON CONFLICT DO NOTHING;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_launch_phase_config_active 
ON launch_phase_config(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 3. FONCTION HELPER POUR VÉRIFIER PHASE DE LANCEMENT
-- =====================================================

CREATE OR REPLACE FUNCTION is_launch_phase_active()
RETURNS BOOLEAN AS $$
DECLARE
    v_end_date TIMESTAMPTZ;
BEGIN
    SELECT end_date INTO v_end_date
    FROM launch_phase_config
    WHERE is_active = TRUE
    ORDER BY id DESC
    LIMIT 1;
    
    IF v_end_date IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN NOW() <= v_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 4. FONCTION HELPER POUR VÉRIFIER SI UTILISATEUR DANS PHASE
-- =====================================================

CREATE OR REPLACE FUNCTION is_user_in_launch_phase(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_created_at TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Vérifier si la phase de lancement est active
    IF NOT is_launch_phase_active() THEN
        RETURN FALSE;
    END IF;
    
    -- Récupérer la date de création de l'utilisateur
    SELECT created_at INTO v_user_created_at
    FROM users
    WHERE id = p_user_id;
    
    IF v_user_created_at IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Récupérer la date de fin de la phase de lancement
    SELECT end_date INTO v_end_date
    FROM launch_phase_config
    WHERE is_active = TRUE
    ORDER BY id DESC
    LIMIT 1;
    
    IF v_end_date IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- L'utilisateur est dans la phase s'il a été créé avant la fin de la phase
    RETURN v_user_created_at <= v_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. COMMENTAIRES
-- =====================================================

COMMENT ON COLUMN users.free_product_created IS 
'Nombre de produits gratuits créés par l''utilisateur (1er produit toujours gratuit)';

COMMENT ON TABLE launch_phase_config IS 
'Configuration de la phase de lancement - Pendant cette phase, les prestataires peuvent créer et réactiver des produits gratuitement';

COMMENT ON FUNCTION is_launch_phase_active() IS 
'Vérifie si on est actuellement dans la phase de lancement';

COMMENT ON FUNCTION is_user_in_launch_phase(INTEGER) IS 
'Vérifie si un utilisateur est dans la phase de lancement (créé avant la fin de la phase)';



