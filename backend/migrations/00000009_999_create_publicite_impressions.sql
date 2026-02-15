-- Migration: Création de la table pour tracker les impressions publicitaires
-- Date: 2025-01-XX
-- Objectif: Gérer la fréquence d'affichage des publicités par utilisateur

-- Table pour tracker les impressions (affichages) de publicités
CREATE TABLE IF NOT EXISTS publicite_impressions (
    id SERIAL PRIMARY KEY,
    publicite_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    placement VARCHAR(50) NOT NULL, -- 'feed', 'stories', 'carousel', 'search', etc.
    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publicite_id) REFERENCES publicites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_user ON publicite_impressions(publicite_id, user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_date ON publicite_impressions(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_date ON publicite_impressions(publicite_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_placement ON publicite_impressions(placement);

-- Index composite pour requêtes de fréquence
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_publicite_date ON publicite_impressions(user_id, publicite_id, viewed_at DESC);

-- Fonction pour vérifier la fréquence d'affichage
CREATE OR REPLACE FUNCTION check_publicite_frequency(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_frequency_type VARCHAR(20) DEFAULT 'daily' -- 'daily', 'weekly', 'unlimited'
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_frequency_limit INTEGER;
    v_frequency_config JSONB;
BEGIN
    -- Récupérer la configuration de fréquence de la publicité
    SELECT frequency_config INTO v_frequency_config
    FROM publicites
    WHERE id = p_publicite_id;
    
    -- Si pas de configuration, autoriser l'affichage
    IF v_frequency_config IS NULL OR v_frequency_config = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    
    -- Déterminer le type de fréquence et la limite
    IF p_frequency_type = 'daily' THEN
        v_frequency_limit := COALESCE((v_frequency_config->>'max_per_day')::INTEGER, 999999);
        
        -- Compter les impressions aujourd'hui
        SELECT COUNT(*) INTO v_count
        FROM publicite_impressions
        WHERE publicite_id = p_publicite_id
        AND user_id = p_user_id
        AND viewed_at >= CURRENT_DATE;
        
    ELSIF p_frequency_type = 'weekly' THEN
        v_frequency_limit := COALESCE((v_frequency_config->>'max_per_week')::INTEGER, 999999);
        
        -- Compter les impressions cette semaine
        SELECT COUNT(*) INTO v_count
        FROM publicite_impressions
        WHERE publicite_id = p_publicite_id
        AND user_id = p_user_id
        AND viewed_at >= DATE_TRUNC('week', CURRENT_DATE);
        
    ELSE
        -- 'unlimited' ou autre
        RETURN TRUE;
    END IF;
    
    -- Vérifier si la limite est atteinte
    RETURN v_count < v_frequency_limit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour enregistrer une impression
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50) DEFAULT 'feed'
) RETURNS INTEGER AS $$
DECLARE
    v_impression_id INTEGER;
BEGIN
    INSERT INTO publicite_impressions (publicite_id, user_id, placement)
    VALUES (p_publicite_id, p_user_id, p_placement)
    RETURNING id INTO v_impression_id;
    
    RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE publicite_impressions IS 'Track les impressions (affichages) de publicités par utilisateur pour gérer la fréquence';
COMMENT ON FUNCTION check_publicite_frequency IS 'Vérifie si une publicité peut être affichée à un utilisateur selon la fréquence configurée';
COMMENT ON FUNCTION record_publicite_impression IS 'Enregistre une impression publicitaire';

