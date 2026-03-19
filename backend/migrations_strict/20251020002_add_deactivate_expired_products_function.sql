-- Migration: Ajouter la fonction deactivate_expired_products() manquante
-- Date: 2025-10-20
-- Description: Fonction pour désactiver automatiquement les produits expirés

-- 1. Créer la table products_lifecycle si elle n'existe pas
CREATE TABLE IF NOT EXISTS products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    last_reactivated_at TIMESTAMPTZ,
    reactivation_cost INTEGER DEFAULT 1000,
    deactivation_count INTEGER DEFAULT 0,
    total_reactivation_paid INTEGER DEFAULT 0,
    UNIQUE(service_id, product_index)
);

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_auto_deactivate ON products_lifecycle(auto_deactivate_at) 
WHERE is_active = TRUE;

-- 3. Fonction pour désactiver automatiquement les produits expirés
-- ✅ CORRIGÉ 2026-01-XX: Utiliser service_products.is_active comme source de vérité
-- Synchroniser products_lifecycle pour les métadonnées de cycle de vie
CREATE OR REPLACE FUNCTION deactivate_expired_products()
RETURNS TABLE(
    service_id INTEGER,
    product_index INTEGER,
    product_nom TEXT,
    user_id INTEGER,
    deactivation_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    UPDATE service_products sp
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        product_data = jsonb_set(
            COALESCE(sp.product_data, '{}'::jsonb),
            '{deactivated_at}',
            to_jsonb(NOW()::text),
            true
        ) || jsonb_build_object(
            'deactivation_type', 'auto',
            'deactivation_reason', 'expired_time'
        )
    FROM services s
    LEFT JOIN products_lifecycle pl ON pl.service_id = sp.service_id AND pl.product_index = sp.product_index
    WHERE sp.service_id = s.id
        AND sp.is_active = TRUE
        AND COALESCE(sp.auto_deactivate_at, pl.auto_deactivate_at) <= NOW()
    RETURNING 
        sp.service_id,
        sp.product_index,
        COALESCE(sp.product_name, pl.product_nom, 'Produit'),
        s.user_id,
        'expired_time'::TEXT;
    
    -- Synchroniser products_lifecycle (métadonnées de cycle de vie)
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM service_products sp
    WHERE pl.service_id = sp.service_id
        AND pl.product_index = sp.product_index
        AND sp.is_active = FALSE
        AND pl.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON FUNCTION deactivate_expired_products IS 'Désactive automatiquement les produits dont la date auto_deactivate_at est dépassée';

