-- Script de correction pour les avertissements de la migration cache_table
-- À appliquer après 20260102_create_cache_table.sql

-- 1. Corriger l'index expires_at (supprimer l'ancien index partiel et créer un index simple)
DROP INDEX IF EXISTS idx_cache_expires_at;

CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at);

-- 2. Corriger la fonction cleanup_expired_cache (supprimer d'abord si elle existe)
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

-- Ajouter le commentaire manquant
COMMENT ON FUNCTION cleanup_expired_cache IS 'Nettoie les entrées expirées du cache et retourne le nombre d''entrées supprimées.';

