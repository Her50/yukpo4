-- Script pour corriger les types de timestamp
-- Vérifier le type actuel de created_at
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'services' AND column_name = 'created_at';

-- Si c'est TIMESTAMPTZ, on peut le laisser tel quel
-- Si c'est TIMESTAMP, on peut le convertir en TIMESTAMPTZ
-- ALTER TABLE services ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'; 