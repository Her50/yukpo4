-- ✅ NOUVEAU: Caractéristiques spécifiques hôtels et meublés
-- Date: 2026-01-26
-- Description: Ajout des fonctionnalités spécifiques pour hôtels et meublés (paiement par heure, événements, équipements)

-- Ajouter colonne prix_location_par_heure (paiement par heure)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'prix_location_par_heure'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN prix_location_par_heure DECIMAL(12, 2);
        
        -- Index pour recherche rapide
        CREATE INDEX IF NOT EXISTS idx_real_estate_prix_location_par_heure 
        ON real_estate_properties(prix_location_par_heure) 
        WHERE prix_location_par_heure IS NOT NULL;
        
        RAISE NOTICE 'Colonne prix_location_par_heure ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne prix_location_par_heure existe déjà';
    END IF;
END $$;

-- Ajouter colonne accepte_loisirs (pour meublés - événements, anniversaires, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'accepte_loisirs'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN accepte_loisirs BOOLEAN DEFAULT FALSE;
        
        -- Index pour recherche rapide
        CREATE INDEX IF NOT EXISTS idx_real_estate_accepte_loisirs 
        ON real_estate_properties(accepte_loisirs) 
        WHERE accepte_loisirs = TRUE;
        
        RAISE NOTICE 'Colonne accepte_loisirs ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne accepte_loisirs existe déjà';
    END IF;
END $$;

-- Ajouter colonne hotel_meuble_services (JSONB pour équipements/services spécifiques)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'hotel_meuble_services'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN hotel_meuble_services JSONB DEFAULT '{}'::jsonb;
        
        -- Index GIN pour recherche rapide dans JSONB
        CREATE INDEX IF NOT EXISTS idx_real_estate_hotel_meuble_services 
        ON real_estate_properties USING GIN(hotel_meuble_services);
        
        RAISE NOTICE 'Colonne hotel_meuble_services ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne hotel_meuble_services existe déjà';
    END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON COLUMN real_estate_properties.prix_location_par_heure IS 'Prix de location par heure (pour hôtels/meublés avec paiement horaire)';
COMMENT ON COLUMN real_estate_properties.accepte_loisirs IS 'Accepte les événements/loisirs (anniversaires, fêtes, etc.) - pour meublés';
COMMENT ON COLUMN real_estate_properties.hotel_meuble_services IS 'Services et équipements spécifiques hôtels/meublés (JSONB): {"salle_conference": true, "salle_fete": true, "restaurant": true, "wifi": true, "canal_plus": true, "piscine": false, ...}';

