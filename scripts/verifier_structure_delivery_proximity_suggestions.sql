-- Script pour vérifier la structure de la table delivery_proximity_suggestions
-- et ajouter la colonne suggested_status si elle manque

-- 1. Vérifier si la table existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'delivery_proximity_suggestions'
        ) THEN '✅ Table existe'
        ELSE '❌ Table n''existe pas'
    END as table_status;

-- 2. Lister toutes les colonnes de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'delivery_proximity_suggestions'
ORDER BY ordinal_position;

-- 3. Vérifier si la colonne suggested_status existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'delivery_proximity_suggestions'
            AND column_name = 'suggested_status'
        ) THEN '✅ Colonne suggested_status existe'
        ELSE '❌ Colonne suggested_status manquante'
    END as suggested_status_status;

-- 4. Si la colonne manque, l'ajouter
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'delivery_proximity_suggestions'
        AND column_name = 'suggested_status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions
        ADD COLUMN suggested_status TEXT NOT NULL DEFAULT 'arrival_pickup';
        
        RAISE NOTICE '✅ Colonne suggested_status ajoutée';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne suggested_status existe déjà';
    END IF;
END $$;

-- 5. Vérification finale
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'delivery_proximity_suggestions'
ORDER BY ordinal_position;

