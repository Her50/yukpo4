-- Script pour ajouter la colonne suggested_status à delivery_proximity_suggestions
-- si elle n'existe pas

DO $$
BEGIN
    -- Vérifier si la colonne existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'delivery_proximity_suggestions'
        AND column_name = 'suggested_status'
    ) THEN
        -- Ajouter la colonne
        ALTER TABLE delivery_proximity_suggestions
        ADD COLUMN suggested_status TEXT NOT NULL DEFAULT 'arrival_pickup';
        
        RAISE NOTICE '✅ Colonne suggested_status ajoutée à delivery_proximity_suggestions';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne suggested_status existe déjà dans delivery_proximity_suggestions';
    END IF;
END $$;

-- Vérification finale
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'delivery_proximity_suggestions'
ORDER BY ordinal_position;

