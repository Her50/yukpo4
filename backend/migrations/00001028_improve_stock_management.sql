-- ✅ Migration : Amélioration de la gestion du stock
-- Date : 2025-01-28
-- Description : 
--   1. Modifie deactivate_expired_products() pour inclure vérification stock = 0
--   2. Ajoute index pour optimiser les vérifications de stock
--   3. Uniquement pour les produits (is_tarissable = TRUE)

-- ✅ 0. DROP la fonction existante pour changer le type de retour
DROP FUNCTION IF EXISTS deactivate_expired_products();

-- ✅ 1. Modifier la fonction deactivate_expired_products() pour inclure vérification stock
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
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM services s
    WHERE pl.service_id = s.id
        AND pl.is_active = TRUE
        AND (
            -- Critère 1: Délai expiré (existant)
            pl.auto_deactivate_at <= NOW()
            OR
            -- ✅ NOUVEAU Critère 2: Stock = 0 (uniquement pour les produits)
            (
                s.is_tarissable = TRUE  -- Uniquement pour les produits
                AND EXISTS (
                    SELECT 1 
                    FROM autocomplete_combinations ac
                    WHERE ac.service_id = s.id
                        AND ac.stock IS NOT NULL
                        AND ac.stock <= 0
                )
            )
        )
    RETURNING 
        pl.service_id,
        pl.product_index,
        pl.product_nom,
        s.user_id,
        CASE 
            WHEN pl.auto_deactivate_at <= NOW() THEN 'expired_time'
            ELSE 'stock_zero'
        END::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ✅ 2. Créer index pour optimiser les vérifications de stock
CREATE INDEX IF NOT EXISTS idx_autocomplete_combinations_stock_check 
ON autocomplete_combinations(service_id, stock) 
WHERE stock IS NOT NULL AND stock <= 0;

CREATE INDEX IF NOT EXISTS idx_services_is_tarissable 
ON services(is_tarissable) 
WHERE is_tarissable = TRUE;

-- ✅ 3. Commentaires
COMMENT ON FUNCTION deactivate_expired_products() IS 
'Désactive automatiquement les produits expirés (30 jours) OU en rupture de stock (stock <= 0). Uniquement pour les produits (is_tarissable = TRUE).';

