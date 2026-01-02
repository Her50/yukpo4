-- Migration: Table de cache PostgreSQL pour remplacer Redis
-- ✅ SOLUTION DÉFINITIVE: Cache basé sur PostgreSQL, plus fiable que Redis

CREATE TABLE IF NOT EXISTS cache_table (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour nettoyer les entrées expirées
-- Note: On ne peut pas utiliser NOW() dans un index partiel car ce n'est pas IMMUTABLE
-- L'index simple sur expires_at permet de filtrer efficacement les entrées expirées
CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at);

-- Index pour les requêtes par pattern (si nécessaire)
CREATE INDEX IF NOT EXISTS idx_cache_key_pattern 
    ON cache_table(cache_key text_pattern_ops);

-- Fonction pour nettoyer les entrées expirées
-- Supprimer d'abord l'ancienne version si elle existe avec une signature différente
DROP FUNCTION IF EXISTS cleanup_expired_cache();

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir une valeur du cache
CREATE OR REPLACE FUNCTION get_cache(key VARCHAR(255))
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Récupérer la valeur si elle n'est pas expirée
    SELECT cache_value INTO result
    FROM cache_table
    WHERE cache_key = key
      AND expires_at > NOW();
    
    -- Mettre à jour les statistiques d'accès
    IF result IS NOT NULL THEN
        UPDATE cache_table
        SET access_count = access_count + 1,
            last_accessed_at = NOW()
        WHERE cache_key = key;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre une valeur en cache
CREATE OR REPLACE FUNCTION set_cache(
    key VARCHAR(255),
    value JSONB,
    ttl_seconds INTEGER DEFAULT 3600
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO cache_table (cache_key, cache_value, expires_at, updated_at)
    VALUES (key, value, NOW() + (ttl_seconds || ' seconds')::INTERVAL, NOW())
    ON CONFLICT (cache_key) 
    DO UPDATE SET
        cache_value = EXCLUDED.cache_value,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at,
        access_count = 0; -- Reset access count on update
END;
$$ LANGUAGE plpgsql;

-- Fonction pour supprimer une clé du cache
CREATE OR REPLACE FUNCTION delete_cache(key VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE cache_key = key;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour supprimer les clés par pattern
CREATE OR REPLACE FUNCTION delete_cache_pattern(pattern VARCHAR(255))
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE cache_key LIKE pattern;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cache_table IS 'Table de cache PostgreSQL pour remplacer Redis. Plus fiable et intégré à la base de données.';
COMMENT ON FUNCTION cleanup_expired_cache IS 'Nettoie les entrées expirées du cache et retourne le nombre d''entrées supprimées.';
COMMENT ON FUNCTION get_cache IS 'Récupère une valeur du cache si elle n''est pas expirée.';
COMMENT ON FUNCTION set_cache IS 'Met une valeur en cache avec un TTL en secondes.';
COMMENT ON FUNCTION delete_cache IS 'Supprime une clé du cache.';
COMMENT ON FUNCTION delete_cache_pattern IS 'Supprime les clés du cache correspondant à un pattern.';

