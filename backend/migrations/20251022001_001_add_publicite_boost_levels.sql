-- Migration: Ajout des niveaux de boost pour les publicités
-- Date: 2025-10-22
-- Description: Ajouter packages Basic/Premium/Ultra pour les publicités

-- ✅ Ajouter colonne niveau de boost
ALTER TABLE publicites ADD COLUMN IF NOT EXISTS boost_level VARCHAR(20) NOT NULL DEFAULT 'basic';

-- ✅ Ajouter contrainte CHECK pour les valeurs autorisées
ALTER TABLE publicites DROP CONSTRAINT IF EXISTS check_boost_level;
ALTER TABLE publicites ADD CONSTRAINT check_boost_level 
    CHECK (boost_level IN ('basic', 'premium', 'ultra'));

-- ✅ Ajouter colonnes pour tracking de visibilité
ALTER TABLE publicites ADD COLUMN IF NOT EXISTS max_appearances_per_session INTEGER NOT NULL DEFAULT 3;
ALTER TABLE publicites ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE publicites ADD COLUMN IF NOT EXISTS frequency_ratio INTEGER NOT NULL DEFAULT 3;

-- ✅ Mettre à jour les valeurs selon le niveau de boost
UPDATE publicites SET 
    max_appearances_per_session = CASE boost_level
        WHEN 'basic' THEN 3
        WHEN 'premium' THEN 5
        WHEN 'ultra' THEN 10
    END,
    cooldown_minutes = CASE boost_level
        WHEN 'basic' THEN 30
        WHEN 'premium' THEN 15
        WHEN 'ultra' THEN 5
    END,
    frequency_ratio = CASE boost_level
        WHEN 'basic' THEN 3    -- 1 toutes les 3 cartes
        WHEN 'premium' THEN 2  -- 1 toutes les 2 cartes
        WHEN 'ultra' THEN 1    -- 1 par carte (alterné)
    END
WHERE boost_level IS NOT NULL;

-- ✅ Créer index pour optimiser les requêtes par boost_level
CREATE INDEX IF NOT EXISTS idx_publicites_boost_level ON publicites(boost_level);
CREATE INDEX IF NOT EXISTS idx_publicites_active_boost ON publicites(status, boost_level, date_fin) 
    WHERE status = 'active';

-- ✅ Fonction pour calculer le coût selon le boost level
CREATE OR REPLACE FUNCTION calculate_publicite_cost(
    p_duree_jours INTEGER,
    p_boost_level VARCHAR(20),
    p_zone_geographique VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
    base_cost INTEGER := 500; -- 500 FCFA par jour (niveau basic)
    zone_multiplier DECIMAL := 1.0;
    boost_multiplier DECIMAL := 1.0;
    total_cost INTEGER;
BEGIN
    -- Multiplicateur zone géographique
    zone_multiplier := CASE p_zone_geographique
        WHEN 'local' THEN 1.0
        WHEN 'regional' THEN 2.0
        WHEN 'international' THEN 5.0
        ELSE 1.0
    END;
    
    -- Multiplicateur niveau de boost
    boost_multiplier := CASE p_boost_level
        WHEN 'basic' THEN 1.0
        WHEN 'premium' THEN 3.0
        WHEN 'ultra' THEN 6.0
        ELSE 1.0
    END;
    
    -- Calcul du coût total
    total_cost := (base_cost * p_duree_jours * zone_multiplier * boost_multiplier)::INTEGER;
    
    RETURN total_cost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ✅ Trigger pour calculer automatiquement le coût
CREATE OR REPLACE FUNCTION set_publicite_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculer le coût si non fourni ou si boost_level/zone change
    IF NEW.cout IS NULL OR NEW.cout = 0 THEN
        NEW.cout := calculate_publicite_cost(
            NEW.duree_jours,
            NEW.boost_level,
            NEW.zone_geographique
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_publicite_cost ON publicites;
CREATE TRIGGER trigger_set_publicite_cost
    BEFORE INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION set_publicite_cost();

-- ✅ Commentaires pour documentation
COMMENT ON COLUMN publicites.boost_level IS 'Niveau de boost: basic (1x), premium (3x), ultra (6x)';
COMMENT ON COLUMN publicites.max_appearances_per_session IS 'Nombre maximum d''apparitions dans une session de 30 min';
COMMENT ON COLUMN publicites.cooldown_minutes IS 'Temps d''attente en minutes avant réapparition';
COMMENT ON COLUMN publicites.frequency_ratio IS 'Fréquence d''apparition: 1 toutes les N cartes';

