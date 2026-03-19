-- Migration: Ajout du flag en_promotion aux produits
-- Date: 2025-10-21
-- Description: Permet d'identifier rapidement les produits en publicité active

-- ✅ Ajouter colonne en_promotion dans table services (JSONB data)
-- Note: Les produits sont stockés dans services.data->produits[]
-- On ajoute un flag computed pour faciliter les requêtes

-- Créer une fonction pour vérifier si un produit est en promotion
CREATE OR REPLACE FUNCTION is_product_in_active_publicite(p_service_id INTEGER, p_product_index INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    product_key TEXT;
BEGIN
    product_key := p_service_id || '_' || p_product_index;
    
    RETURN EXISTS (
        SELECT 1
        FROM publicites
        WHERE product_key = ANY(produits_indexes)
        AND status = 'active'
        AND date_fin > NOW()
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ✅ Créer une vue pour faciliter l'accès aux produits avec leur status de promotion
CREATE OR REPLACE VIEW products_with_promotion AS
SELECT 
    s.id as service_id,
    s.user_id,
    s.data,
    idx as product_index,
    product as product_data,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM publicites pub
            WHERE s.id || '_' || idx = ANY(pub.produits_indexes)
            AND pub.status = 'active'
            AND pub.date_fin > NOW()
        ) THEN true
        ELSE false
    END as en_promotion,
    (
        SELECT pub.id
        FROM publicites pub
        WHERE s.id || '_' || idx = ANY(pub.produits_indexes)
        AND pub.status = 'active'
        AND pub.date_fin > NOW()
        LIMIT 1
    ) as publicite_id,
    (
        SELECT pub.zone_geographique
        FROM publicites pub
        WHERE s.id || '_' || idx = ANY(pub.produits_indexes)
        AND pub.status = 'active'
        AND pub.date_fin > NOW()
        LIMIT 1
    ) as publicite_zone,
    (
        SELECT pub.geo_publicitaire
        FROM publicites pub
        WHERE s.id || '_' || idx = ANY(pub.produits_indexes)
        AND pub.status = 'active'
        AND pub.date_fin > NOW()
        LIMIT 1
    ) as publicite_geo
FROM 
    services s,
    jsonb_array_elements((s.data->'produits')::jsonb) WITH ORDINALITY AS t(product, idx)
WHERE 
    jsonb_typeof((s.data->'produits')::jsonb) = 'array'
    AND jsonb_array_length((s.data->'produits')::jsonb) > 0;

-- ✅ Index sur la vue matérialisée (optionnel, pour meilleures performances)
-- CREATE MATERIALIZED VIEW products_with_promotion_mat AS
-- SELECT * FROM products_with_promotion;
-- CREATE INDEX idx_products_promo_service ON products_with_promotion_mat(service_id);
-- CREATE INDEX idx_products_promo_flag ON products_with_promotion_mat(en_promotion);

-- ✅ Fonction pour rafraîchir automatiquement le statut de promotion
-- Peut être appelée périodiquement ou après chaque création/modification de publicité
CREATE OR REPLACE FUNCTION refresh_products_promotion_status()
RETURNS TABLE(service_id INTEGER, product_index BIGINT, en_promotion BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id::INTEGER as service_id,
        idx as product_index,
        EXISTS (
            SELECT 1 FROM publicites pub
            WHERE s.id || '_' || idx = ANY(pub.produits_indexes)
            AND pub.status = 'active'
            AND pub.date_fin > NOW()
        ) as en_promotion
    FROM 
        services s,
        jsonb_array_elements((s.data->'produits')::jsonb) WITH ORDINALITY AS t(product, idx)
    WHERE 
        jsonb_typeof((s.data->'produits')::jsonb) = 'array';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_product_in_active_publicite IS 'Vérifie si un produit spécifique est dans une publicité active';
COMMENT ON VIEW products_with_promotion IS 'Vue permettant d''accéder rapidement aux produits avec leur statut de promotion';
COMMENT ON FUNCTION refresh_products_promotion_status IS 'Rafraîchit le statut de promotion de tous les produits';




