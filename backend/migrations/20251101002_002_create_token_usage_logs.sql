-- Migration : Créer la table token_usage_logs pour l'historique des consommations de tokens
-- Date : 2025-11-01
-- Compatible avec SQLx offline mode (fichier SQL standard)

-- Créer la table pour stocker l'historique des consommations de tokens
CREATE TABLE IF NOT EXISTS token_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intention VARCHAR(100) NOT NULL, -- 'creation_service', 'recherche_besoin', 'assistance_generale', etc.
    tokens_ia_consumed INTEGER NOT NULL, -- Nombre de tokens IA réellement consommés
    tokens_cost_xaf INTEGER NOT NULL, -- Coût en XAF
    tokens_deducted INTEGER NOT NULL, -- Tokens déduits du solde (équivalent XAF)
    balance_before BIGINT NOT NULL, -- Solde avant déduction
    balance_after BIGINT NOT NULL, -- Solde après déduction
    processing_time_ms INTEGER, -- Temps de traitement en millisecondes
    response_source VARCHAR(50), -- 'cache', 'optimized', 'external'
    endpoint VARCHAR(255), -- Endpoint appelé
    request_metadata JSONB, -- Métadonnées de la requête (optionnel)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_token_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_logs_created_at ON token_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_token_logs_intention ON token_usage_logs(intention);
CREATE INDEX IF NOT EXISTS idx_token_logs_user_date ON token_usage_logs(user_id, created_at DESC);

-- Commentaires pour documentation
COMMENT ON TABLE token_usage_logs IS 'Historique détaillé de toutes les consommations de tokens IA par utilisateur';
COMMENT ON COLUMN token_usage_logs.intention IS 'Type d''opération effectuée (creation_service, recherche_besoin, etc.)';
COMMENT ON COLUMN token_usage_logs.tokens_ia_consumed IS 'Nombre réel de tokens IA consommés lors de l''appel';
COMMENT ON COLUMN token_usage_logs.tokens_cost_xaf IS 'Coût calculé en XAF basé sur l''intention';
COMMENT ON COLUMN token_usage_logs.tokens_deducted IS 'Nombre de tokens déduits du solde utilisateur (1 token = 1 XAF)';
COMMENT ON COLUMN token_usage_logs.response_source IS 'Source de la réponse : cache (gratuit), optimized (réduit), external (complet)';

-- Fonction pour obtenir les stats de consommation d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_token_stats(p_user_id INTEGER, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_requests BIGINT,
    total_tokens_consumed BIGINT,
    total_cost_xaf BIGINT,
    avg_tokens_per_request NUMERIC,
    by_intention JSONB,
    by_source JSONB,
    daily_consumption JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            COUNT(*) as request_count,
            SUM(tokens_ia_consumed) as total_tokens,
            SUM(tokens_cost_xaf) as total_xaf,
            AVG(tokens_ia_consumed) as avg_tokens,
            intention,
            response_source,
            DATE(created_at) as consumption_date
        FROM token_usage_logs
        WHERE user_id = p_user_id
          AND created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
        GROUP BY intention, response_source, DATE(created_at)
    )
    SELECT
        SUM(request_count)::BIGINT as total_requests,
        SUM(total_tokens)::BIGINT as total_tokens_consumed,
        SUM(total_xaf)::BIGINT as total_cost_xaf,
        AVG(avg_tokens)::NUMERIC as avg_tokens_per_request,
        
        -- Stats par intention
        (SELECT jsonb_object_agg(intention, json_build_object(
            'count', SUM(request_count),
            'tokens', SUM(total_tokens),
            'cost_xaf', SUM(total_xaf)
        ))
        FROM stats
        GROUP BY intention) as by_intention,
        
        -- Stats par source
        (SELECT jsonb_object_agg(response_source, json_build_object(
            'count', SUM(request_count),
            'tokens', SUM(total_tokens)
        ))
        FROM stats
        WHERE response_source IS NOT NULL
        GROUP BY response_source) as by_source,
        
        -- Consommation journalière
        (SELECT jsonb_object_agg(consumption_date::TEXT, json_build_object(
            'count', SUM(request_count),
            'tokens', SUM(total_tokens),
            'cost_xaf', SUM(total_xaf)
        ))
        FROM stats
        GROUP BY consumption_date
        ORDER BY consumption_date DESC) as daily_consumption
    FROM stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_token_stats IS 'Retourne les statistiques de consommation de tokens pour un utilisateur sur N jours';

-- Vue pour les 10 dernières consommations par utilisateur (utile pour l'historique)
CREATE OR REPLACE VIEW recent_token_usage AS
SELECT 
    tul.id,
    tul.user_id,
    u.nom_complet as user_name,
    tul.intention,
    tul.tokens_ia_consumed,
    tul.tokens_cost_xaf,
    tul.tokens_deducted,
    tul.balance_before,
    tul.balance_after,
    tul.processing_time_ms,
    tul.response_source,
    tul.endpoint,
    tul.created_at,
    ROW_NUMBER() OVER (PARTITION BY tul.user_id ORDER BY tul.created_at DESC) as row_num
FROM token_usage_logs tul
JOIN users u ON tul.user_id = u.id
ORDER BY tul.created_at DESC;

COMMENT ON VIEW recent_token_usage IS 'Vue avec les consommations récentes enrichies des infos utilisateur';

-- Insérer quelques données de test si la table est vide
DO $$
DECLARE
    test_user_id INTEGER;
BEGIN
    -- Récupérer le premier utilisateur pour les tests
    SELECT id INTO test_user_id FROM users WHERE role = 'prestataire' LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Insérer des exemples d'historique (5 derniers jours)
        INSERT INTO token_usage_logs (user_id, intention, tokens_ia_consumed, tokens_cost_xaf, tokens_deducted, balance_before, balance_after, processing_time_ms, response_source, endpoint, created_at)
        VALUES
            (test_user_id, 'creation_service', 150, 60, 60, 5000, 4940, 1250, 'external', '/api/ia/creation-service', CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (test_user_id, 'recherche_besoin', 80, 0, 0, 4940, 4940, 800, 'external', '/api/search/direct', CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (test_user_id, 'creation_service', 200, 80, 80, 4940, 4860, 1500, 'optimized', '/api/ia/creation-service', CURRENT_TIMESTAMP - INTERVAL '2 days'),
            (test_user_id, 'recherche_besoin', 60, 0, 0, 4860, 4860, 650, 'cache', '/api/search/direct', CURRENT_TIMESTAMP - INTERVAL '2 days'),
            (test_user_id, 'assistance_generale', 100, 4, 4, 4860, 4856, 900, 'external', '/api/ia/auto', CURRENT_TIMESTAMP - INTERVAL '3 days'),
            (test_user_id, 'creation_service', 180, 72, 72, 4856, 4784, 1400, 'external', '/api/ia/creation-service', CURRENT_TIMESTAMP - INTERVAL '4 days'),
            (test_user_id, 'recherche_besoin', 90, 0, 0, 4784, 4784, 750, 'external', '/api/search/direct', CURRENT_TIMESTAMP - INTERVAL '5 days')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Données de test insérées pour user_id %', test_user_id;
    ELSE
        RAISE NOTICE 'Aucun utilisateur prestataire trouvé pour insérer des données de test';
    END IF;
END $$;

