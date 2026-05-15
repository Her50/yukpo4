-- ✅ NOUVEAU Phase 3: Ajouter support vidéos pour biens immobiliers
-- Migration pour ajouter colonne videos dans real_estate_properties

-- Ajouter colonne videos si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'videos'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN videos TEXT[] DEFAULT '{}';
        
        -- Index pour recherche rapide
        CREATE INDEX IF NOT EXISTS idx_real_estate_videos 
        ON real_estate_properties USING GIN(videos);
        
        RAISE NOTICE 'Colonne videos ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne videos existe déjà';
    END IF;
END $$;

-- ✅ NOUVEAU Phase 4: Ajouter colonne has_virtual_tour pour optimisation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'real_estate_properties' 
        AND column_name = 'has_virtual_tour'
    ) THEN
        ALTER TABLE real_estate_properties 
        ADD COLUMN has_virtual_tour BOOLEAN DEFAULT FALSE;
        
        -- Index pour recherche rapide
        CREATE INDEX IF NOT EXISTS idx_real_estate_has_virtual_tour 
        ON real_estate_properties(has_virtual_tour) 
        WHERE has_virtual_tour = TRUE;
        
        -- Mettre à jour les biens existants qui ont des visites virtuelles
        UPDATE real_estate_properties p
        SET has_virtual_tour = TRUE
        WHERE EXISTS (
            SELECT 1 FROM property_virtual_tours vt
            WHERE vt.property_id = p.id
        );
        
        RAISE NOTICE 'Colonne has_virtual_tour ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne has_virtual_tour existe déjà';
    END IF;
END $$;

