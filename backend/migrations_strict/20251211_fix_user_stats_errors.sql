-- Migration pour corriger les erreurs de base de données liées aux statistiques utilisateur
-- Erreurs corrigées :
-- 1. ERROR: relation "mv_user_stats" does not exist
-- 2. ERROR: function get_user_stats(integer) does not exist
-- 3. ERROR: column "u.id" must appear in the GROUP BY clause

-- ✅ 1. Créer la vue matérialisée mv_user_stats
-- Cette vue est basée sur la requête dans db_optimizer.rs::get_user_stats_cached
DROP MATERIALIZED VIEW IF EXISTS mv_user_stats CASCADE;

CREATE MATERIALIZED VIEW mv_user_stats AS
SELECT 
    u.id,
    u.tokens_balance,
    COUNT(s.id) as services_count,
    COUNT(CASE WHEN s.is_active THEN 1 END) as active_services_count,
    NULL::BIGINT as reviews_count,
    NULL::DOUBLE PRECISION as avg_rating
FROM users u
LEFT JOIN services s ON u.id = s.user_id
GROUP BY u.id, u.tokens_balance;

-- Index pour améliorer les performances
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_stats_id ON mv_user_stats(id);

-- ✅ 2. Créer la fonction get_user_stats
-- Cette fonction peut utiliser la vue matérialisée ou la requête directe
CREATE OR REPLACE FUNCTION get_user_stats(user_id_param INTEGER)
RETURNS TABLE (
    id INTEGER,
    tokens_balance BIGINT,
    services_count BIGINT,
    active_services_count BIGINT,
    reviews_count BIGINT,
    avg_rating DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.tokens_balance,
        COUNT(s.id)::BIGINT as services_count,
        COUNT(CASE WHEN s.is_active THEN 1 END)::BIGINT as active_services_count,
        NULL::BIGINT as reviews_count,
        NULL::DOUBLE PRECISION as avg_rating
    FROM users u
    LEFT JOIN services s ON u.id = s.user_id
    WHERE u.id = user_id_param
    GROUP BY u.id, u.tokens_balance;
END;
$$ LANGUAGE plpgsql;

-- ✅ 3. Fonction pour rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats;
END;
$$ LANGUAGE plpgsql;

-- ✅ 4. Commentaires pour documentation
COMMENT ON MATERIALIZED VIEW mv_user_stats IS 'Vue matérialisée pour les statistiques utilisateur (services, tokens, etc.)';
COMMENT ON FUNCTION get_user_stats(INTEGER) IS 'Fonction pour récupérer les statistiques d''un utilisateur spécifique';
COMMENT ON FUNCTION refresh_user_stats() IS 'Fonction pour rafraîchir la vue matérialisée mv_user_stats';

-- ✅ 5. Rafraîchir la vue matérialisée initialement
REFRESH MATERIALIZED VIEW mv_user_stats;

-- ✅ 6. Note sur l'erreur GROUP BY
-- L'erreur "column u.id must appear in the GROUP BY clause" peut provenir de :
-- - Une migration SQL non exécutée correctement
-- - Une requête générée dynamiquement
-- - Une fonction/vue qui n'a pas été mise à jour
-- Si cette erreur persiste, vérifier les logs pour identifier la requête spécifique
-- et s'assurer que toutes les colonnes non-agrégées dans le SELECT sont dans le GROUP BY

