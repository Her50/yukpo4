-- Migration: Créer la fonction get_product_reactions_count
-- Date: 2025-11-27
-- Description: Fonction pour récupérer le décompte des réactions par type pour un produit

-- Créer la fonction si elle n'existe pas
CREATE OR REPLACE FUNCTION get_product_reactions_count(
    p_service_id INTEGER,
    p_product_id TEXT
)
RETURNS TABLE (
    reaction_type TEXT,
    count BIGINT,
    users_sample TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.reaction_type::TEXT,
        COUNT(*)::BIGINT as count,
        ARRAY_AGG(DISTINCT u.email::TEXT) FILTER (WHERE u.email IS NOT NULL) as users_sample
    FROM product_reactions pr
    LEFT JOIN users u ON pr.user_id = u.id
    WHERE pr.service_id = p_service_id
      AND pr.product_id = p_product_id
    GROUP BY pr.reaction_type
    ORDER BY count DESC, pr.reaction_type;
END;
$$ LANGUAGE plpgsql STABLE;

-- Commentaire sur la fonction
COMMENT ON FUNCTION get_product_reactions_count(INTEGER, TEXT) IS 
'Récupère le décompte des réactions par type pour un produit spécifique, avec un échantillon des utilisateurs ayant réagi';

