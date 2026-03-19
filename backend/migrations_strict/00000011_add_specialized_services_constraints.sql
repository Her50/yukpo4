-- Migration: Ajouter contraintes de validation pour services spécialisés
-- Date: 2025-01-28
-- Description: CHECK constraints pour valider les données avant insertion
--              Cohérence des heures, dates, prix, places, etc.
-- Note: Compatible avec SQLx offline mode

-- ============================================================================
-- PHARMACIES : Validation heures d'ouverture/fermeture
-- ============================================================================

-- Contrainte : heures_ouverture < heures_fermeture OU permanent_24h = true
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_pharmacies_heures_valid' AND table_name = 'pharmacies'
    ) THEN
        ALTER TABLE pharmacies ADD CONSTRAINT check_pharmacies_heures_valid
            CHECK (
                permanent_24h = true OR
                (heures_ouverture IS NULL AND heures_fermeture IS NULL) OR
                (heures_ouverture IS NOT NULL AND heures_fermeture IS NOT NULL AND heures_ouverture < heures_fermeture)
            );
    END IF;
END $$;

COMMENT ON CONSTRAINT check_pharmacies_heures_valid ON pharmacies IS 
    'Valide que les heures d''ouverture sont avant les heures de fermeture, sauf si permanent_24h';

-- ============================================================================
-- AGENCES DE VOYAGE : Validation heures d'ouverture/fermeture
-- ============================================================================

-- Contrainte : heures_ouverture < heures_fermeture
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_agences_heures_valid' AND table_name = 'agences_voyage'
    ) THEN
        ALTER TABLE agences_voyage ADD CONSTRAINT check_agences_heures_valid
            CHECK (
                (heures_ouverture IS NULL AND heures_fermeture IS NULL) OR
                (heures_ouverture IS NOT NULL AND heures_fermeture IS NOT NULL AND heures_ouverture < heures_fermeture)
            );
    END IF;
END $$;

COMMENT ON CONSTRAINT check_agences_heures_valid ON agences_voyage IS 
    'Valide que les heures d''ouverture sont avant les heures de fermeture';

-- ============================================================================
-- COVOITURAGES : Validation dates, places, prix
-- ============================================================================

-- Contrainte 1 : date_depart doit être dans le futur (au moment de la création)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_date_future' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_date_future
            CHECK (date_depart > created_at);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_covoiturages_date_future ON covoiturages IS 
    'Valide que la date de départ est dans le futur';

-- Contrainte 2 : places_disponibles <= nombre_places
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_places_valid' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_places_valid
            CHECK (places_disponibles >= 0 AND places_disponibles <= nombre_places);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_covoiturages_places_valid ON covoiturages IS 
    'Valide que les places disponibles ne dépassent pas le nombre total de places';

-- Contrainte 3 : prix_par_place > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_prix_valid' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_prix_valid
            CHECK (prix_par_place > 0);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_covoiturages_prix_valid ON covoiturages IS 
    'Valide que le prix par place est strictement positif';

-- Contrainte 4 : depart != destination
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_depart_destination' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_depart_destination
            CHECK (depart != destination);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_covoiturages_depart_destination ON covoiturages IS 
    'Valide que le départ est différent de la destination';

-- Contrainte 5 : nombre_places > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_nombre_places' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_nombre_places
            CHECK (nombre_places > 0);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_covoiturages_nombre_places ON covoiturages IS 
    'Valide que le nombre de places est strictement positif';

-- ============================================================================
-- TAXIS : Validation tarifs
-- ============================================================================

-- Contrainte 1 : tarif_base > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_taxis_tarif_base' AND table_name = 'taxis_ville'
    ) THEN
        ALTER TABLE taxis_ville ADD CONSTRAINT check_taxis_tarif_base
            CHECK (tarif_base > 0);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_taxis_tarif_base ON taxis_ville IS 
    'Valide que le tarif de base est strictement positif';

-- Contrainte 2 : tarif_par_km > 0
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_taxis_tarif_par_km' AND table_name = 'taxis_ville'
    ) THEN
        ALTER TABLE taxis_ville ADD CONSTRAINT check_taxis_tarif_par_km
            CHECK (tarif_par_km > 0);
    END IF;
END $$;

COMMENT ON CONSTRAINT check_taxis_tarif_par_km ON taxis_ville IS 
    'Valide que le tarif par km est strictement positif';

-- ============================================================================
-- VALIDATION GPS (Format: "lat,lng")
-- ============================================================================

-- Fonction pour valider le format GPS
CREATE OR REPLACE FUNCTION is_valid_gps_format(gps_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF gps_text IS NULL THEN
        RETURN TRUE; -- NULL est valide (optionnel)
    END IF;
    
    -- Format attendu: "lat,lng" avec deux nombres décimaux
    RETURN gps_text ~ '^-?\d+\.?\d*,-?\d+\.?\d*$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Contrainte GPS pour pharmacies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_pharmacies_gps_format' AND table_name = 'pharmacies'
    ) THEN
        ALTER TABLE pharmacies ADD CONSTRAINT check_pharmacies_gps_format
            CHECK (gps IS NULL OR is_valid_gps_format(gps));
    END IF;
END $$;

-- Contrainte GPS pour hopitaux
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_hopitaux_gps_format' AND table_name = 'hopitaux_cliniques'
    ) THEN
        ALTER TABLE hopitaux_cliniques ADD CONSTRAINT check_hopitaux_gps_format
            CHECK (gps IS NULL OR is_valid_gps_format(gps));
    END IF;
END $$;

-- Contrainte GPS pour laboratoires
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_laboratoires_gps_format' AND table_name = 'laboratoires_imagerie'
    ) THEN
        ALTER TABLE laboratoires_imagerie ADD CONSTRAINT check_laboratoires_gps_format
            CHECK (gps IS NULL OR is_valid_gps_format(gps));
    END IF;
END $$;

-- Contrainte GPS pour agences
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_agences_gps_format' AND table_name = 'agences_voyage'
    ) THEN
        ALTER TABLE agences_voyage ADD CONSTRAINT check_agences_gps_format
            CHECK (gps IS NULL OR is_valid_gps_format(gps));
    END IF;
END $$;

-- Contrainte GPS pour covoiturages (départ et destination)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_gps_depart_format' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_gps_depart_format
            CHECK (gps_depart IS NULL OR is_valid_gps_format(gps_depart));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_covoiturages_gps_destination_format' AND table_name = 'covoiturages'
    ) THEN
        ALTER TABLE covoiturages ADD CONSTRAINT check_covoiturages_gps_destination_format
            CHECK (gps_destination IS NULL OR is_valid_gps_format(gps_destination));
    END IF;
END $$;

-- Contrainte GPS pour taxis
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_taxis_gps_format' AND table_name = 'taxis_ville'
    ) THEN
        ALTER TABLE taxis_ville ADD CONSTRAINT check_taxis_gps_format
            CHECK (gps_actuel IS NULL OR is_valid_gps_format(gps_actuel));
    END IF;
END $$;

-- ============================================================================
-- VALIDATION EMAIL (format basique)
-- ============================================================================

-- Fonction pour valider le format email
CREATE OR REPLACE FUNCTION is_valid_email_format(email_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF email_text IS NULL THEN
        RETURN TRUE; -- NULL est valide (optionnel)
    END IF;
    
    -- Format basique: caractères + @ + domaine
    RETURN email_text ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Contrainte email pour pharmacies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_pharmacies_email_format' AND table_name = 'pharmacies'
    ) THEN
        ALTER TABLE pharmacies ADD CONSTRAINT check_pharmacies_email_format
            CHECK (email IS NULL OR is_valid_email_format(email));
    END IF;
END $$;

-- Contrainte email pour hopitaux
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_hopitaux_email_format' AND table_name = 'hopitaux_cliniques'
    ) THEN
        ALTER TABLE hopitaux_cliniques ADD CONSTRAINT check_hopitaux_email_format
            CHECK (email IS NULL OR is_valid_email_format(email));
    END IF;
END $$;

-- Contrainte email pour laboratoires
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_laboratoires_email_format' AND table_name = 'laboratoires_imagerie'
    ) THEN
        ALTER TABLE laboratoires_imagerie ADD CONSTRAINT check_laboratoires_email_format
            CHECK (email IS NULL OR is_valid_email_format(email));
    END IF;
END $$;

-- Contrainte email pour agences
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_agences_email_format' AND table_name = 'agences_voyage'
    ) THEN
        ALTER TABLE agences_voyage ADD CONSTRAINT check_agences_email_format
            CHECK (email IS NULL OR is_valid_email_format(email));
    END IF;
END $$;

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================

-- ✅ Compatible SQLx offline mode :
--    - Utilisation de DO $$ blocks pour vérifications
--    - IF NOT EXISTS pour éviter les erreurs si contraintes existent déjà
--    - CREATE OR REPLACE FUNCTION pour fonctions utilitaires

-- ✅ Validation stricte :
--    - Heures : ouverture < fermeture
--    - Dates : date_depart > created_at
--    - Places : places_disponibles <= nombre_places
--    - Prix : tous les prix > 0
--    - GPS : format "lat,lng" validé
--    - Email : format basique validé

-- ✅ Cohérence :
--    - Toutes les contraintes sont optionnelles (NULL autorisé)
--    - Messages d'erreur clairs via COMMENT ON CONSTRAINT
--    - Fonctions réutilisables pour validation GPS et email

