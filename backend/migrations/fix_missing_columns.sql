-- Migration de correctif : Ajouter les colonnes et fonctions manquantes
-- Date : 2025-11-03
-- Cette migration corrige les éléments manquants si la base n'est pas à jour

-- 1. Vérifier et ajouter session_id à autocomplete_combinations (si manquante)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'autocomplete_combinations'
        AND column_name = 'session_id'
    ) THEN
        ALTER TABLE autocomplete_combinations ADD COLUMN session_id TEXT;
        RAISE NOTICE 'Colonne session_id ajoutée à autocomplete_combinations';
    END IF;
END $$;

-- 2. Créer la fonction upsert_autocomplete_combination si manquante
CREATE OR REPLACE FUNCTION upsert_autocomplete_combination(
    p_product_vector TEXT[],
    p_location_vector TEXT[],
    p_full_vector TEXT[],
    p_product_labels TEXT[],
    p_location_labels TEXT[],
    p_chosen_location TEXT,
    p_is_ai_preferred BOOLEAN,
    p_ai_confidence FLOAT,
    p_session_id TEXT,
    p_has_variant BOOLEAN,
    p_variant_dimension TEXT,
    p_variant_value TEXT,
    p_prix NUMERIC,
    p_devise TEXT,
    p_stock INTEGER,
    p_service_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Insérer ou récupérer l'ID
    INSERT INTO autocomplete_combinations (
        product_vector, location_vector, full_vector,
        product_labels, location_labels,
        chosen_location, is_ai_preferred, ai_confidence, session_id,
        has_variant, variant_dimension, variant_value,
        prix, devise, stock, service_id, usage_count
    ) VALUES (
        p_product_vector, p_location_vector, p_full_vector,
        p_product_labels, p_location_labels,
        p_chosen_location, p_is_ai_preferred, p_ai_confidence, p_session_id,
        p_has_variant, p_variant_dimension, p_variant_value,
        p_prix, p_devise, p_stock, p_service_id, 1
    )
    ON CONFLICT (full_vector) DO UPDATE SET
        usage_count = autocomplete_combinations.usage_count + 1,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Créer la table token_usage_logs si manquante
CREATE TABLE IF NOT EXISTS token_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intention VARCHAR(100) NOT NULL,
    tokens_ia_consumed INTEGER NOT NULL,
    tokens_cost_xaf INTEGER NOT NULL,
    tokens_deducted INTEGER NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    processing_time_ms INTEGER,
    response_source VARCHAR(50),
    endpoint VARCHAR(255),
    request_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Créer les index manquants
CREATE INDEX IF NOT EXISTS idx_token_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_logs_created_at ON token_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_token_logs_intention ON token_usage_logs(intention);
CREATE INDEX IF NOT EXISTS idx_token_logs_user_date ON token_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combinations_session ON autocomplete_combinations(session_id);

-- Fin
SELECT 'Migration de correctif appliquée avec succès' as status;

