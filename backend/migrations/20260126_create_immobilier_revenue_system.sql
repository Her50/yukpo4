-- ✅ NOUVEAU: Système de rémunération Yukpo Immobilier
-- Date: 2026-01-26
-- Description: Commission sur réservations hôtels/meublés + Visibilité payante pour autres biens

-- ============================================
-- 1. COMMISSIONS HÔTELS/MEUBLÉS
-- ============================================

-- Table des commissions sur réservations
CREATE TABLE IF NOT EXISTS immobilier_commissions (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES hotel_meuble_reservations(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Commission
    montant_reservation DECIMAL(14, 2) NOT NULL, -- Montant total réservation (même si paiement partiel)
    taux_commission DECIMAL(5, 4) NOT NULL DEFAULT 0.15, -- Taux commission (ex: 0.15 pour 15%)
    montant_commission DECIMAL(14, 2) NOT NULL, -- Montant commission Yukpo
    montant_reverse DECIMAL(14, 2) NOT NULL, -- Montant reversé au propriétaire
    
    -- Paiement
    payment_type VARCHAR(20) NOT NULL, -- "advance", "full", "remaining"
    montant_paye DECIMAL(14, 2) NOT NULL, -- Montant effectivement payé
    commission_prelevee DECIMAL(14, 2) NOT NULL, -- Commission prélevée sur ce paiement
    montant_reverse_effectif DECIMAL(14, 2) NOT NULL, -- Montant effectivement reversé
    
    -- Statut
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- "pending", "collected", "refunded"
    commission_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- "pending", "collected", "refunded"
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collected_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Contraintes
    CONSTRAINT check_commission_amounts CHECK (
        montant_commission >= 0 
        AND montant_reverse >= 0 
        AND commission_prelevee >= 0
    )
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_immobilier_commissions_reservation 
ON immobilier_commissions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_immobilier_commissions_property 
ON immobilier_commissions(property_id);
CREATE INDEX IF NOT EXISTS idx_immobilier_commissions_user 
ON immobilier_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_immobilier_commissions_status 
ON immobilier_commissions(commission_status, payment_status);

-- ============================================
-- 2. VISIBILITÉ PAYANTE (AUTRES BIENS)
-- ============================================

-- Table des abonnements de visibilité
CREATE TABLE IF NOT EXISTS immobilier_visibility_subscriptions (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Visibilité
    jours_visibilite INTEGER NOT NULL CHECK (jours_visibilite > 0),
    date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_fin TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Coût
    prix_bien DECIMAL(14, 2) NOT NULL, -- Prix au moment de l'activation
    type_bien VARCHAR(50) NOT NULL, -- Type de bien pour déterminer taux
    taux_commission DECIMAL(5, 4) NOT NULL, -- Taux appliqué (ex: 0.005 pour 0.5%)
    cout_total DECIMAL(14, 2) NOT NULL, -- Coût total calculé
    tokens_deduits BIGINT NOT NULL, -- Tokens effectivement déduits
    
    -- Statut
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- "active", "expired", "cancelled", "suspended"
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expired_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Contraintes
    CONSTRAINT check_visibility_dates CHECK (date_fin > date_debut),
    CONSTRAINT check_visibility_cost CHECK (cout_total >= 0 AND tokens_deduits >= 0)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_visibility_subscriptions_property 
ON immobilier_visibility_subscriptions(property_id);
CREATE INDEX IF NOT EXISTS idx_visibility_subscriptions_user 
ON immobilier_visibility_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_visibility_subscriptions_status 
ON immobilier_visibility_subscriptions(status, is_active);
CREATE INDEX IF NOT EXISTS idx_visibility_subscriptions_dates 
ON immobilier_visibility_subscriptions(date_fin) 
WHERE is_active = TRUE AND status = 'active';

-- ============================================
-- 3. MODIFICATIONS real_estate_properties
-- ============================================

-- Ajouter colonnes pour visibilité
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'visibility_expires_at'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN visibility_expires_at TIMESTAMPTZ;
        
        ALTER TABLE real_estate_properties 
        ADD COLUMN visibility_cost_tokens BIGINT DEFAULT 0;
        
        ALTER TABLE real_estate_properties 
        ADD COLUMN is_visible_in_search BOOLEAN DEFAULT TRUE;
        
        ALTER TABLE real_estate_properties 
        ADD COLUMN last_visibility_activation TIMESTAMPTZ;
        
        RAISE NOTICE 'Colonnes visibilité ajoutées avec succès';
    ELSE
        RAISE NOTICE 'Colonnes visibilité existent déjà';
    END IF;
END $$;

-- Index pour recherche (seulement biens visibles)
CREATE INDEX IF NOT EXISTS idx_real_estate_visible_search 
ON real_estate_properties(is_visible_in_search, visibility_expires_at) 
WHERE is_visible_in_search = TRUE 
AND (visibility_expires_at IS NULL OR visibility_expires_at > NOW());

-- ============================================
-- 4. MODIFICATIONS hotel_meuble_reservations
-- ============================================

-- Ajouter colonnes pour commission
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'hotel_meuble_reservations' 
        AND column_name = 'yukpo_commission_amount'
    ) THEN
        ALTER TABLE hotel_meuble_reservations 
        ADD COLUMN yukpo_commission_amount DECIMAL(14, 2) DEFAULT 0;
        
        ALTER TABLE hotel_meuble_reservations 
        ADD COLUMN commission_rate DECIMAL(5, 4) DEFAULT 0.15;
        
        ALTER TABLE hotel_meuble_reservations 
        ADD COLUMN commission_status VARCHAR(20) DEFAULT 'pending';
        
        ALTER TABLE hotel_meuble_reservations 
        ADD COLUMN commission_collected_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Colonnes commission ajoutées avec succès';
    ELSE
        RAISE NOTICE 'Colonnes commission existent déjà';
    END IF;
END $$;

-- ============================================
-- 5. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction : Calculer taux commission selon type de bien
CREATE OR REPLACE FUNCTION get_commission_rate_for_property_type(type_bien TEXT)
RETURNS DECIMAL(5, 4) AS $$
BEGIN
    RETURN CASE 
        WHEN type_bien = 'maison' OR type_bien = 'villa' THEN 0.005 -- 0.5%
        WHEN type_bien = 'appartement' THEN 0.007 -- 0.7%
        WHEN type_bien = 'terrain' THEN 0.003 -- 0.3%
        WHEN type_bien = 'bureau' THEN 0.006 -- 0.6%
        WHEN type_bien = 'salle_de_fete' OR type_bien = 'espace_loisir' OR type_bien = 'espace_ceremonie' THEN 0.008 -- 0.8%
        WHEN type_bien = 'coworking' THEN 0.006 -- 0.6%
        WHEN type_bien = 'local_commercial' THEN 0.005 -- 0.5%
        ELSE 0.005 -- 0.5% par défaut
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Calculer coût visibilité
CREATE OR REPLACE FUNCTION calculate_visibility_cost(
    p_prix_bien DECIMAL,
    p_type_bien TEXT,
    p_jours INTEGER
)
RETURNS DECIMAL(14, 2) AS $$
DECLARE
    v_taux DECIMAL(5, 4);
    v_cout_jour DECIMAL(14, 2);
    v_cout_total DECIMAL(14, 2);
BEGIN
    -- Récupérer le taux selon le type
    v_taux := get_commission_rate_for_property_type(p_type_bien);
    
    -- Calculer coût par jour
    v_cout_jour := p_prix_bien * v_taux;
    
    -- Calculer coût total
    v_cout_total := v_cout_jour * p_jours;
    
    -- Appliquer minimum et maximum selon type
    CASE p_type_bien
        WHEN 'maison' OR 'villa' THEN
            v_cout_total := GREATEST(10000, LEAST(500000, v_cout_total));
        WHEN 'appartement' THEN
            v_cout_total := GREATEST(7000, LEAST(350000, v_cout_total));
        WHEN 'terrain' THEN
            v_cout_total := GREATEST(5000, LEAST(200000, v_cout_total));
        WHEN 'bureau' THEN
            v_cout_total := GREATEST(8000, LEAST(400000, v_cout_total));
        WHEN 'salle_de_fete' OR 'espace_loisir' OR 'espace_ceremonie' THEN
            v_cout_total := GREATEST(10000, LEAST(500000, v_cout_total));
        ELSE
            v_cout_total := GREATEST(5000, LEAST(300000, v_cout_total));
    END CASE;
    
    RETURN v_cout_total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : Désactiver automatiquement les biens expirés
CREATE OR REPLACE FUNCTION deactivate_expired_properties()
RETURNS TABLE(
    property_id INTEGER,
    user_id INTEGER,
    property_title TEXT
) AS $$
BEGIN
    RETURN QUERY
    UPDATE real_estate_properties p
    SET 
        is_visible_in_search = FALSE,
        updated_at = NOW()
    FROM services s
    WHERE p.service_id = s.id
        AND p.is_visible_in_search = TRUE
        AND p.visibility_expires_at IS NOT NULL
        AND p.visibility_expires_at < NOW()
        AND p.type_bien NOT IN ('hôtel', 'meublé') -- Hôtels/meublés gérés différemment
    RETURNING 
        p.id,
        s.user_id,
        p.titre;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Trigger : Mettre à jour updated_at pour visibility_subscriptions
CREATE OR REPLACE FUNCTION update_visibility_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_visibility_subscriptions_updated_at 
ON immobilier_visibility_subscriptions;
CREATE TRIGGER trigger_update_visibility_subscriptions_updated_at
    BEFORE UPDATE ON immobilier_visibility_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_visibility_subscriptions_updated_at();

-- ============================================
-- 7. VUES UTILITAIRES
-- ============================================

-- Vue : Statistiques commissions par propriétaire
CREATE OR REPLACE VIEW v_immobilier_commissions_stats AS
SELECT 
    user_id,
    COUNT(*) as total_reservations,
    SUM(montant_commission) as total_commissions,
    SUM(montant_reverse) as total_reverse,
    AVG(taux_commission) as avg_commission_rate
FROM immobilier_commissions
WHERE commission_status = 'collected'
GROUP BY user_id;

-- Vue : Statistiques visibilité par propriétaire
CREATE OR REPLACE VIEW v_immobilier_visibility_stats AS
SELECT 
    user_id,
    COUNT(*) as total_subscriptions,
    SUM(tokens_deduits) as total_tokens_spent,
    SUM(jours_visibilite) as total_days_purchased,
    COUNT(*) FILTER (WHERE status = 'active' AND is_active = TRUE) as active_subscriptions
FROM immobilier_visibility_subscriptions
GROUP BY user_id;

