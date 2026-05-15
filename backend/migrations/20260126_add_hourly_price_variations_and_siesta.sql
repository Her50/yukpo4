-- ✅ NOUVEAU: Migration pour variations de prix horaire et sieste
-- Date: 2026-01-26
-- Objectif: Gérer les variations de prix par heure (normale/creuse) et le concept de sieste (2h)

-- Ajouter colonne pour variations de prix horaire (JSONB)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'prix_location_par_heure_variations'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN prix_location_par_heure_variations JSONB DEFAULT '{}';
        
        CREATE INDEX IF NOT EXISTS idx_real_estate_prix_heure_variations 
        ON real_estate_properties USING GIN(prix_location_par_heure_variations);
        
        RAISE NOTICE 'Colonne prix_location_par_heure_variations ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne prix_location_par_heure_variations existe déjà';
    END IF;
END $$;

-- Ajouter colonne pour prix sieste (2h)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'prix_location_sieste'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN prix_location_sieste DECIMAL(12, 2);
        
        CREATE INDEX IF NOT EXISTS idx_real_estate_prix_sieste 
        ON real_estate_properties(prix_location_sieste) 
        WHERE prix_location_sieste IS NOT NULL;
        
        RAISE NOTICE 'Colonne prix_location_sieste ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne prix_location_sieste existe déjà';
    END IF;
END $$;

-- Structure JSONB pour prix_location_par_heure_variations :
-- {
--   "standard": 5000,      // Prix heure standard
--   "creuse": 3000,         // Prix heure creuse (ex: 12h-15h, 22h-6h)
--   "pleine": 7000,         // Prix heure pleine (ex: 18h-22h)
--   "horaires_creuse": {    // Plages horaires creuses
--     "debut": "12:00",
--     "fin": "15:00"
--   },
--   "horaires_pleine": {    // Plages horaires pleines
--     "debut": "18:00",
--     "fin": "22:00"
--   }
-- }

