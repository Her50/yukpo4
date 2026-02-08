#!/bin/bash
# Script complet pour executer le script SQL de correction dans CloudShell

set -e

echo "============================================================"
echo "🔧 Application du Script SQL de Correction"
echo "============================================================"
echo ""

# Configuration
export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang?sslmode=require"
export PGPASSWORD="SztViedrXvuBDyj16TWaIAs25FfUColh"

# Verifier si psql est installe
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql n'est pas installe. Installation en cours..."
    
    # Detectar le systeme (Amazon Linux ou Ubuntu)
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "amzn" ]]; then
            echo "📦 Installation de PostgreSQL client (Amazon Linux)..."
            sudo yum install -y postgresql15 || sudo yum install -y postgresql
        elif [[ "$ID" == "ubuntu" ]] || [[ "$ID" == "debian" ]]; then
            echo "📦 Installation de PostgreSQL client (Ubuntu/Debian)..."
            sudo apt-get update
            sudo apt-get install -y postgresql-client
        else
            echo "❌ Systeme d'exploitation non supporte: $ID"
            exit 1
        fi
    else
        echo "❌ Impossible de detecter le systeme d'exploitation"
        exit 1
    fi
    
    echo "✅ PostgreSQL client installe"
    echo ""
fi

# Verifier la version de psql
echo "📋 Version de psql:"
psql --version
echo ""

# Creer le fichier SQL temporaire
SQL_FILE="/tmp/fix_missing_tables_and_functions.sql"

echo "📝 Creation du fichier SQL..."
cat > "$SQL_FILE" << 'EOFSQL'
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

-- Index spatial pour recherche géographique (nécessite PostGIS)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_location 
        ON user_saved_addresses USING GIST(ST_MakePoint(longitude, latitude));
    END IF;
END $$;

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

-- Vérifier d'abord si la fonction calculate_vector_match_score_optimized existe
-- Si elle n'existe pas, on la crée d'abord
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
    -- Compter les éléments qui matchent
    SELECT COUNT(*) INTO match_count
    FROM unnest(vector_normalized) AS elem
    WHERE elem = ANY(search_keywords_normalized);
    
    -- Calculer le score (pourcentage de match)
    total_elements := array_length(vector_normalized, 1);
    IF total_elements IS NULL OR total_elements = 0 THEN
        RETURN 0.0;
    END IF;
    
    score := (match_count::REAL / total_elements::REAL) * 100.0;
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Créer la fonction calculate_best_vector_match_score
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

-- S'assurer que l'index unique existe pour permettre REFRESH CONCURRENTLY
DO $$
BEGIN
    -- Vérifier que la vue existe
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        -- Supprimer l'ancien index s'il existe avec une clause WHERE (non valide pour refresh concurrent)
        DROP INDEX IF EXISTS idx_services_search_optimized_v2_unique;
        
        -- Créer l'index unique SANS clause WHERE (requis pour REFRESH CONCURRENTLY)
        CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_optimized_v2_unique
        ON services_search_optimized_v2 (service_id);
        
        RAISE NOTICE '✅ Index unique créé pour services_search_optimized_v2';
    ELSE
        RAISE WARNING '⚠️ Vue matérialisée services_search_optimized_v2 n''existe pas encore';
    END IF;
END $$;

-- Corriger la fonction refresh_services_search_optimized pour utiliser l'index
CREATE OR REPLACE FUNCTION refresh_services_search_optimized()
RETURNS VOID AS $$
BEGIN
    -- Vérifier que la vue existe
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'services_search_optimized_v2') THEN
        -- Vérifier que l'index unique existe
        IF EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexname = 'idx_services_search_optimized_v2_unique'
        ) THEN
            -- Utiliser REFRESH CONCURRENTLY si l'index existe
            REFRESH MATERIALIZED VIEW CONCURRENTLY services_search_optimized_v2;
            RAISE NOTICE '✅ Vue matérialisée services_search_optimized_v2 rafraîchie (CONCURRENTLY)';
        ELSE
            -- Utiliser REFRESH normal si l'index n'existe pas
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

-- =====================================================
-- 5. VÉRIFICATIONS FINALES
-- =====================================================

DO $$
DECLARE
    table_exists BOOLEAN;
    func1_exists BOOLEAN;
    func2_exists BOOLEAN;
    view_exists BOOLEAN;
    index_exists BOOLEAN;
BEGIN
    -- Vérifier user_saved_addresses
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_saved_addresses'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ Table user_saved_addresses existe';
    ELSE
        RAISE WARNING '❌ Table user_saved_addresses n''existe pas';
    END IF;
    
    -- Vérifier calculate_best_vector_match_score
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_best_vector_match_score'
    ) INTO func1_exists;
    
    IF func1_exists THEN
        RAISE NOTICE '✅ Fonction calculate_best_vector_match_score existe';
    ELSE
        RAISE WARNING '❌ Fonction calculate_best_vector_match_score n''existe pas';
    END IF;
    
    -- Vérifier product_combination_exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'product_combination_exists'
    ) INTO func2_exists;
    
    IF func2_exists THEN
        RAISE NOTICE '✅ Fonction product_combination_exists existe';
    ELSE
        RAISE WARNING '❌ Fonction product_combination_exists n''existe pas';
    END IF;
    
    -- Vérifier services_search_optimized_v2
    SELECT EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE matviewname = 'services_search_optimized_v2'
    ) INTO view_exists;
    
    IF view_exists THEN
        RAISE NOTICE '✅ Vue matérialisée services_search_optimized_v2 existe';
        
        -- Vérifier l'index unique
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'services_search_optimized_v2' 
            AND indexname = 'idx_services_search_optimized_v2_unique'
        ) INTO index_exists;
        
        IF index_exists THEN
            RAISE NOTICE '✅ Index unique pour services_search_optimized_v2 existe';
        ELSE
            RAISE WARNING '❌ Index unique pour services_search_optimized_v2 n''existe pas';
        END IF;
    ELSE
        RAISE WARNING '⚠️ Vue matérialisée services_search_optimized_v2 n''existe pas encore';
    END IF;
END $$;

COMMENT ON INDEX idx_services_search_optimized_v2_unique IS 
'Index unique requis pour permettre REFRESH MATERIALIZED VIEW CONCURRENTLY sur services_search_optimized_v2 - Créé 2026-02-07';
EOFSQL

echo "✅ Fichier SQL créé: $SQL_FILE"
echo ""

# Tester la connexion
echo "🔌 Test de connexion à la base de données..."
if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Connexion réussie!"
    echo ""
else
    echo "❌ Erreur de connexion à la base de données"
    echo "Vérifiez que:"
    echo "  - La base de données est accessible depuis CloudShell"
    echo "  - Les credentials sont corrects"
    exit 1
fi

# Executer le script SQL
echo "🚀 Exécution du script SQL de correction..."
echo ""

if psql "$DATABASE_URL" -f "$SQL_FILE"; then
    echo ""
    echo "============================================================"
    echo "✅ Script SQL exécuté avec succès!"
    echo "============================================================"
    echo ""
    echo "📋 Vérifications finales:"
    psql "$DATABASE_URL" -c "
        SELECT 'Table user_saved_addresses' as element, 
               CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_saved_addresses') 
                    THEN '✅ Existe' ELSE '❌ Manquante' END as status
        UNION ALL
        SELECT 'Fonction calculate_best_vector_match_score' as element,
               CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_best_vector_match_score')
                    THEN '✅ Existe' ELSE '❌ Manquante' END as status
        UNION ALL
        SELECT 'Fonction product_combination_exists' as element,
               CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'product_combination_exists')
                    THEN '✅ Existe' ELSE '❌ Manquante' END as status;
    "
else
    echo ""
    echo "============================================================"
    echo "❌ Erreur lors de l'exécution du script SQL"
    echo "============================================================"
    exit 1
fi

# Nettoyer
rm -f "$SQL_FILE"
echo ""
echo "✨ Terminé!"



