-- Migration: Corriger la contrainte unique manquante sur geo_hierarchy
-- Date: 2025-11-27
-- Description: Corrige l'erreur "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--              dans places_controller.rs enrich_location (ligne 310)
--              Ajoute une contrainte UNIQUE sur (place_name, parent_country) pour permettre ON CONFLICT

-- Créer une contrainte unique sur (place_name, parent_country) si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'geo_hierarchy_place_name_parent_country_key'
        AND conrelid = 'geo_hierarchy'::regclass
    ) THEN
        ALTER TABLE geo_hierarchy 
        ADD CONSTRAINT geo_hierarchy_place_name_parent_country_key 
        UNIQUE (place_name, parent_country);
    END IF;
END $$;

-- Créer un index unique si la contrainte n'existe toujours pas
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_hierarchy_place_parent_unique 
ON geo_hierarchy (place_name, parent_country);

