import json
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def lambda_handler(event, context):
    """
    Fonction Lambda pour executer le script SQL de correction
    """
    
    # Recuperer DATABASE_URL depuis les variables d'environnement
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'DATABASE_URL non definie'})
        }
    
    # Script SQL complet
    sql_script = """
-- ✅ CORRECTION CRITIQUE 2026-02-07: Corriger toutes les tables et fonctions manquantes identifiées dans les logs
-- Erreurs identifiées dans les logs:
-- 1. Table user_saved_addresses n'existe pas
-- 2. Fonction calculate_best_vector_match_score n'existe pas
-- 3. Fonction product_combination_exists n'existe pas
-- 4. Vue matérialisée services_search_optimized_v2 - Index unique manquant pour REFRESH CONCURRENTLY

-- =====================================================
-- 1. CRÉER LA TABLE user_saved_addresses
-- =====================================================

CREATE TABLE IF NOT EXISTS user_saved_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identification de l'adresse
    label VARCHAR(100) NOT NULL,
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('pickup', 'dropoff', 'both')),
    
    -- Données géographiques
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Enrichissement (composants LocationObject)
    location_data JSONB DEFAULT '{}'::jsonb,
    
    -- Informations complémentaires
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    instructions TEXT,
    building_number VARCHAR(50),
    floor VARCHAR(50),
    apartment VARCHAR(50),
    
    -- Métadonnées
    is_default_pickup BOOLEAN DEFAULT FALSE,
    is_default_dropoff BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Un seul label par utilisateur (éviter les doublons)
    UNIQUE(user_id, label)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id ON user_saved_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_type ON user_saved_addresses(user_id, address_type);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_default ON user_saved_addresses(user_id, is_default_pickup, is_default_dropoff);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_active ON user_saved_addresses(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_last_used ON user_saved_addresses(user_id, last_used_at DESC NULLS LAST);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_saved_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_saved_addresses_updated_at ON user_saved_addresses;
CREATE TRIGGER trigger_update_user_saved_addresses_updated_at
    BEFORE UPDATE ON user_saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_user_saved_addresses_updated_at();

-- Fonction pour incrémenter usage_count
CREATE OR REPLACE FUNCTION increment_user_saved_address_usage(address_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE user_saved_addresses
    SET usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = address_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_saved_addresses IS 'Adresses sauvegardées par les utilisateurs pour pickup et dropoff de livraisons';

-- =====================================================
-- 2. CRÉER LA FONCTION calculate_best_vector_match_score
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_vector_match_score_optimized(
    vector_normalized TEXT[],
    search_keywords_normalized TEXT[]
)
RETURNS REAL AS $$
DECLARE
    match_count INTEGER;
    total_elements INTEGER;
    score REAL;
BEGIN
    SELECT COUNT(*) INTO match_count
    FROM unnest(vector_normalized) AS elem
    WHERE elem = ANY(search_keywords_normalized);
    
    total_elements := array_length(vector_normalized, 1);
    IF total_elements IS NULL OR total_elements = 0 THEN
        RETURN 0.0;
    END IF;
    
    score := (match_count::REAL / total_elements::REAL) * 100.0;
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_best_vector_match_score(
    characteristic_vector_normalized TEXT[],
    full_vector_normalized TEXT[],
    search_keywords_normalized TEXT[]
)
RETURNS REAL AS $$
    SELECT GREATEST(
        COALESCE(calculate_vector_match_score_optimized(characteristic_vector_normalized, search_keywords_normalized), 0.0),
        COALESCE(calculate_vector_match_score_optimized(full_vector_normalized, search_keywords_normalized), 0.0)
    );
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION calculate_best_vector_match_score IS 'Calcule le meilleur score vectoriel entre characteristic et full_vector en une seule passe';

-- =====================================================
-- 3. CRÉER LA FONCTION product_combination_exists
-- =====================================================

CREATE OR REPLACE FUNCTION product_combination_exists(
    p_product_vector TEXT[]
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM autocomplete_combinations
        WHERE product_vector = p_product_vector
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION product_combination_exists IS 'Vérifie si une combinaison produit existe déjà dans autocomplete_combinations';

-- =====================================================
-- 4. CORRIGER LA VUE MATÉRIALISÉE services_search_optimized_v2
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        DROP INDEX IF EXISTS idx_services_search_optimized_v2_unique;
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique
        ON services_search_optimized_v2 (service_id);
        
        RAISE NOTICE '✅ Index unique créé pour services_search_optimized_v2';
    ELSE
        RAISE WARNING '⚠️ Vue matérialisée services_search_optimized_v2 n''existe pas encore';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION refresh_services_search_optimized()
RETURNS VOID AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        IF EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexname = 'idx_services_search_optimized_v2_unique'
        ) THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized_v2;
            RAISE NOTICE '✅ Vue matérialisée services_search_optimized_v2 rafraîchie (CONCURRENTLY)';
        ELSE
            REFRESH MATERIALIZED VIEW services_search_optimized_v2;
            RAISE NOTICE '✅ Vue matérialisée services_search_optimized_v2 rafraîchie (normal)';
        END IF;
    ELSE
        RAISE WARNING '⚠️ Vue matérialisée services_search_optimized_v2 n''existe pas';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_services_search_optimized IS 
'Fonction pour rafraîchir la vue matérialisée services_search_optimized_v2 - Corrigée 2026-02-07';
"""
    
    try:
        # Se connecter à la base de données
        conn = psycopg2.connect(database_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Executer le script SQL
        cursor.execute(sql_script)
        
        # Verifier les resultats
        cursor.execute("""
            SELECT 
                EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_saved_addresses') as table_exists,
                EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_best_vector_match_score') as func1_exists,
                EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'product_combination_exists') as func2_exists
        """)
        
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Script SQL execute avec succes',
                'table_exists': result[0],
                'func1_exists': result[1],
                'func2_exists': result[2]
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }



