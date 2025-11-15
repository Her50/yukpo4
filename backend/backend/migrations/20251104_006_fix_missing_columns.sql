-- Migration: ajouter les colonnes manquantes
-- product_labels dans autocomplete_combinations
-- tokens_ia_consumed dans token_usage_logs

-- 1. Ajouter product_labels a autocomplete_combinations si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'autocomplete_combinations'
          AND column_name = 'product_labels'
    ) THEN
        ALTER TABLE autocomplete_combinations
        ADD COLUMN product_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

        COMMENT ON COLUMN autocomplete_combinations.product_labels IS 'Labels correspondant a chaque valeur du product_vector. Ex: ["marque", "modele", "couleur", "pointure"]';
    END IF;
END $$;

-- 2. Ajouter tokens_ia_consumed a token_usage_logs si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'token_usage_logs'
          AND column_name = 'tokens_ia_consumed'
    ) THEN
        ALTER TABLE token_usage_logs
        ADD COLUMN tokens_ia_consumed INTEGER NOT NULL DEFAULT 0;

        COMMENT ON COLUMN token_usage_logs.tokens_ia_consumed IS 'Nombre reel de tokens IA consommes lors de l''appel';
    END IF;
END $$;