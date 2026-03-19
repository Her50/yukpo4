-- Migration: Système de gestion des horaires de départ par ville/agence
-- Date: 2025-11-27
-- Description: Permet aux agences de définir les horaires de départ disponibles pour chaque trajet

-- 1. Table pour les horaires de départ par agence/ville
CREATE TABLE IF NOT EXISTS agency_departure_schedules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    departure_city TEXT NOT NULL,
    arrival_city TEXT NOT NULL,
    departure_times TIME[] NOT NULL, -- ["08:00", "14:00", "20:00"] - Horaires disponibles
    day_of_week INTEGER, -- 0=Dimanche, 1=Lundi, ..., 6=Samedi (NULL = tous les jours)
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT, -- Notes optionnelles (ex: "Horaires spéciaux fêtes")
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contrainte unique : une agence ne peut avoir qu'un seul horaire par trajet/jour
    UNIQUE(agency_user_id, departure_city, arrival_city, day_of_week)
);

-- 2. Index pour performances
CREATE INDEX IF NOT EXISTS idx_agency_schedules_route ON agency_departure_schedules(departure_city, arrival_city);
CREATE INDEX IF NOT EXISTS idx_agency_schedules_agency ON agency_departure_schedules(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_schedules_active ON agency_departure_schedules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_agency_schedules_day ON agency_departure_schedules(day_of_week) WHERE day_of_week IS NOT NULL;

-- 3. Fonction pour récupérer les horaires disponibles pour un trajet
CREATE OR REPLACE FUNCTION get_available_departure_times(
    p_agency_user_id INTEGER,
    p_departure_city TEXT,
    p_arrival_city TEXT,
    p_date DATE DEFAULT NULL -- Si NULL, retourne tous les horaires (tous jours)
)
RETURNS TABLE(
    departure_time TIME,
    day_of_week INTEGER,
    is_specific_day BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        unnest(ads.departure_times) as departure_time,
        ads.day_of_week,
        (ads.day_of_week IS NOT NULL) as is_specific_day
    FROM agency_departure_schedules ads
    WHERE ads.agency_user_id = p_agency_user_id
        AND ads.departure_city = p_departure_city
        AND ads.arrival_city = p_arrival_city
        AND ads.is_active = TRUE
        AND (
            -- Si jour spécifique demandé, retourner uniquement ce jour
            (p_date IS NOT NULL AND ads.day_of_week = EXTRACT(DOW FROM p_date))
            -- Si horaire pour tous les jours
            OR ads.day_of_week IS NULL
            -- Si pas de date spécifiée, retourner tous les horaires
            OR p_date IS NULL
        )
    ORDER BY ads.day_of_week NULLS FIRST, departure_time;
END;
$$ LANGUAGE plpgsql;

-- 4. Fonction pour vérifier si un horaire existe pour un trajet
CREATE OR REPLACE FUNCTION check_departure_time_exists(
    p_agency_user_id INTEGER,
    p_departure_city TEXT,
    p_arrival_city TEXT,
    p_departure_time TIME,
    p_date DATE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM agency_departure_schedules ads
        WHERE ads.agency_user_id = p_agency_user_id
            AND ads.departure_city = p_departure_city
            AND ads.arrival_city = p_arrival_city
            AND p_departure_time = ANY(ads.departure_times)
            AND ads.is_active = TRUE
            AND (
                (p_date IS NOT NULL AND ads.day_of_week = EXTRACT(DOW FROM p_date))
                OR ads.day_of_week IS NULL
                OR p_date IS NULL
            )
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_agency_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agency_schedules_updated_at
    BEFORE UPDATE ON agency_departure_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_agency_schedules_updated_at();

-- 6. Commentaires
COMMENT ON TABLE agency_departure_schedules IS 'Horaires de départ disponibles par agence, ville et trajet. Permet de définir les heures de départ pour chaque trajet.';
COMMENT ON COLUMN agency_departure_schedules.departure_times IS 'Tableau des horaires disponibles (ex: ["08:00", "14:00", "20:00"])';
COMMENT ON COLUMN agency_departure_schedules.day_of_week IS 'Jour de la semaine (0=Dimanche, 1=Lundi, ..., 6=Samedi). NULL = tous les jours';
COMMENT ON FUNCTION get_available_departure_times IS 'Retourne les horaires disponibles pour un trajet donné, optionnellement filtrés par date';
COMMENT ON FUNCTION check_departure_time_exists IS 'Vérifie si un horaire spécifique existe pour un trajet donné';

