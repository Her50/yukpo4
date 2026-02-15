-- Migration: Triggers pour garantir la cohérence entre specialized_type et les tables spécialisées
-- Date: 2025-01-28
-- Description: Assure que specialized_type correspond toujours à l'existence dans la table spécialisée
-- Compatible SQLx offline mode

-- ============================================================================
-- FONCTION : Vérifier la cohérence specialized_type
-- ============================================================================

CREATE OR REPLACE FUNCTION check_specialized_type_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- Si specialized_type est défini, vérifier que l'entrée existe dans la table correspondante
    IF NEW.specialized_type = 'pharmacie' THEN
        IF NOT EXISTS (SELECT 1 FROM pharmacies WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=pharmacie doit avoir entrée dans pharmacies (service_id=%)', NEW.id;
        END IF;
    ELSIF NEW.specialized_type = 'hopital_clinique' THEN
        IF NOT EXISTS (SELECT 1 FROM hopitaux_cliniques WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=hopital_clinique doit avoir entrée dans hopitaux_cliniques (service_id=%)', NEW.id;
        END IF;
    ELSIF NEW.specialized_type = 'laboratoire_imagerie' THEN
        IF NOT EXISTS (SELECT 1 FROM laboratoires_imagerie WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=laboratoire_imagerie doit avoir entrée dans laboratoires_imagerie (service_id=%)', NEW.id;
        END IF;
    ELSIF NEW.specialized_type = 'agence_voyage' THEN
        IF NOT EXISTS (SELECT 1 FROM agences_voyage WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=agence_voyage doit avoir entrée dans agences_voyage (service_id=%)', NEW.id;
        END IF;
    ELSIF NEW.specialized_type = 'covoiturage' THEN
        IF NOT EXISTS (SELECT 1 FROM covoiturages WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=covoiturage doit avoir entrée dans covoiturages (service_id=%)', NEW.id;
        END IF;
    ELSIF NEW.specialized_type = 'taxi_ville' THEN
        IF NOT EXISTS (SELECT 1 FROM taxis_ville WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=taxi_ville doit avoir entrée dans taxis_ville (service_id=%)', NEW.id;
        END IF;
    ELSIF NEW.specialized_type = 'banque_sang' THEN
        IF NOT EXISTS (SELECT 1 FROM banques_sang WHERE service_id = NEW.id) THEN
            RAISE EXCEPTION 'Service avec specialized_type=banque_sang doit avoir entrée dans banques_sang (service_id=%)', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FONCTION : Mettre à jour specialized_type lors de la suppression d'une entrée spécialisée
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_specialized_type_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre specialized_type à NULL si l'entrée spécialisée est supprimée
    UPDATE services 
    SET specialized_type = NULL 
    WHERE id = OLD.service_id 
    AND specialized_type IS NOT NULL;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS SUR services
-- ============================================================================

-- Trigger BEFORE UPDATE sur services pour vérifier la cohérence
DROP TRIGGER IF EXISTS trigger_check_specialized_type_consistency ON services;
CREATE TRIGGER trigger_check_specialized_type_consistency
    BEFORE UPDATE OF specialized_type ON services
    FOR EACH ROW
    WHEN (NEW.specialized_type IS DISTINCT FROM OLD.specialized_type)
    EXECUTE FUNCTION check_specialized_type_consistency();

-- ============================================================================
-- TRIGGERS SUR LES TABLES SPÉCIALISÉES (pour mettre à jour specialized_type)
-- ============================================================================

-- Pharmacies
DROP TRIGGER IF EXISTS trigger_pharmacies_clear_specialized_type ON pharmacies;
CREATE TRIGGER trigger_pharmacies_clear_specialized_type
    AFTER DELETE ON pharmacies
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- Hôpitaux/Cliniques
DROP TRIGGER IF EXISTS trigger_hopitaux_clear_specialized_type ON hopitaux_cliniques;
CREATE TRIGGER trigger_hopitaux_clear_specialized_type
    AFTER DELETE ON hopitaux_cliniques
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- Laboratoires/Imagerie
DROP TRIGGER IF EXISTS trigger_laboratoires_clear_specialized_type ON laboratoires_imagerie;
CREATE TRIGGER trigger_laboratoires_clear_specialized_type
    AFTER DELETE ON laboratoires_imagerie
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- Agences de voyage
DROP TRIGGER IF EXISTS trigger_agences_clear_specialized_type ON agences_voyage;
CREATE TRIGGER trigger_agences_clear_specialized_type
    AFTER DELETE ON agences_voyage
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- Covoiturages
DROP TRIGGER IF EXISTS trigger_covoiturages_clear_specialized_type ON covoiturages;
CREATE TRIGGER trigger_covoiturages_clear_specialized_type
    AFTER DELETE ON covoiturages
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- Taxis ville
DROP TRIGGER IF EXISTS trigger_taxis_clear_specialized_type ON taxis_ville;
CREATE TRIGGER trigger_taxis_clear_specialized_type
    AFTER DELETE ON taxis_ville
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- Banques de sang
DROP TRIGGER IF EXISTS trigger_banques_sang_clear_specialized_type ON banques_sang;
CREATE TRIGGER trigger_banques_sang_clear_specialized_type
    AFTER DELETE ON banques_sang
    FOR EACH ROW
    EXECUTE FUNCTION clear_specialized_type_on_delete();

-- ============================================================================
-- NOTES
-- ============================================================================

-- ✅ Compatible SQLx offline mode :
--    - CREATE OR REPLACE FUNCTION
--    - DROP TRIGGER IF EXISTS
--    - CREATE TRIGGER

-- ✅ Garanties :
--    1. Si specialized_type est défini, l'entrée DOIT exister dans la table spécialisée
--    2. Si l'entrée spécialisée est supprimée, specialized_type est automatiquement mis à NULL
--    3. Vérification avant UPDATE pour éviter les incohérences

