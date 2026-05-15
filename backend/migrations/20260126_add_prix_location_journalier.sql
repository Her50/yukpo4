-- ✅ NOUVEAU: Ajouter colonne prix_location_journalier pour hôtels et meublés
-- Date: 2026-01-26
-- Description: Les hôtels et meublés sont généralement facturés en jours et non en mois

-- Ajouter colonne prix_location_journalier si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'prix_location_journalier'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN prix_location_journalier DECIMAL(12, 2);
        
        -- Index pour recherche rapide
        CREATE INDEX IF NOT EXISTS idx_real_estate_prix_location_journalier 
        ON real_estate_properties(prix_location_journalier) 
        WHERE prix_location_journalier IS NOT NULL;
        
        RAISE NOTICE 'Colonne prix_location_journalier ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne prix_location_journalier existe déjà';
    END IF;
END $$;

