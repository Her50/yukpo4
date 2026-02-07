-- Script de vérification du schéma courier_applications
-- Utilisez ce script pour vérifier si la colonne partner_id existe

-- 1. Vérifier si la colonne partner_id existe
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'courier_applications' 
    AND column_name = 'partner_id';

-- 2. Si la colonne n'existe pas, l'ajouter
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_applications' AND column_name = 'partner_id'
    ) THEN
        ALTER TABLE courier_applications 
        ADD COLUMN partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);
        
        RAISE NOTICE '✅ Colonne partner_id ajoutée à courier_applications';
    ELSE
        RAISE NOTICE '✅ Colonne partner_id existe déjà';
    END IF;
END
$$;

-- 3. Vérifier la structure complète de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'courier_applications'
ORDER BY ordinal_position;

-- 4. Vérifier les contraintes
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'courier_applications'::regclass;

