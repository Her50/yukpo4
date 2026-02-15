-- Migration: Tables pour historique et recherches sauvegardées
-- Date: 2025-01-28
-- Description: Permet de sauvegarder l'historique de recherche et les recherches favorites

-- Table pour historique de recherches
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    specialized_type VARCHAR(50),
    filters JSONB,
    results_count INTEGER DEFAULT 0,
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_query_time UNIQUE(user_id, query, searched_at)
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_type ON search_history(specialized_type);

COMMENT ON TABLE search_history IS 
    'Historique des recherches effectuées par les utilisateurs';

-- Table pour recherches sauvegardées
CREATE TABLE IF NOT EXISTS saved_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    specialized_type VARCHAR(50),
    filters JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_search_name UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_type ON saved_searches(specialized_type);

COMMENT ON TABLE saved_searches IS 
    'Recherches sauvegardées par les utilisateurs pour accès rapide';

