-- ✅ NOUVEAU: Support réservations horaires pour hôtels et meublés
-- Date: 2026-01-26
-- Description: Ajout du support pour réservations par heure (pas seulement par nuitées)

-- Ajouter colonnes pour réservations horaires
ALTER TABLE hotel_meuble_reservations
ADD COLUMN IF NOT EXISTS reservation_type VARCHAR(20) DEFAULT 'nightly' CHECK (reservation_type IN ('nightly', 'hourly')),
ADD COLUMN IF NOT EXISTS heure_arrivee TIME,
ADD COLUMN IF NOT EXISTS heure_depart TIME,
ADD COLUMN IF NOT EXISTS nombre_heures INTEGER,
ADD COLUMN IF NOT EXISTS prix_heure DECIMAL(10, 2);

-- Index pour réservations horaires
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_type ON hotel_meuble_reservations(reservation_type);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_heures ON hotel_meuble_reservations(property_id, date_arrivee, heure_arrivee, date_depart, heure_depart) 
WHERE reservation_type = 'hourly';

-- Modifier la contrainte check_dates pour supporter les réservations horaires
-- (date_depart peut être égal à date_arrivee si c'est une réservation horaire)
ALTER TABLE hotel_meuble_reservations
DROP CONSTRAINT IF EXISTS check_dates;

ALTER TABLE hotel_meuble_reservations
ADD CONSTRAINT check_dates CHECK (
    (reservation_type = 'nightly' AND date_depart > date_arrivee)
    OR (reservation_type = 'hourly' AND (
        date_depart > date_arrivee 
        OR (date_depart = date_arrivee AND heure_depart > heure_arrivee)
    ))
);

-- Modifier la contrainte check_nuitees pour supporter les réservations horaires
ALTER TABLE hotel_meuble_reservations
DROP CONSTRAINT IF EXISTS check_nuitees;

ALTER TABLE hotel_meuble_reservations
ADD CONSTRAINT check_nuitees CHECK (
    (reservation_type = 'nightly' AND nombre_nuitees > 0)
    OR (reservation_type = 'hourly' AND nombre_heures > 0)
);

-- Fonction améliorée pour vérifier disponibilité avec support horaire
CREATE OR REPLACE FUNCTION check_hotel_availability_hybrid(
    p_property_id INTEGER,
    p_date_arrivee DATE,
    p_date_depart DATE,
    p_exclude_reservation_id INTEGER DEFAULT NULL,
    p_heure_arrivee TIME DEFAULT NULL,
    p_heure_depart TIME DEFAULT NULL,
    p_reservation_type VARCHAR(20) DEFAULT 'nightly'
) RETURNS BOOLEAN AS $$
DECLARE
    v_conflicting_reservations INTEGER;
    v_conflicting_blocks INTEGER;
    v_arrivee_timestamp TIMESTAMP;
    v_depart_timestamp TIMESTAMP;
BEGIN
    -- Construire les timestamps pour comparaison
    IF p_reservation_type = 'hourly' AND p_heure_arrivee IS NOT NULL AND p_heure_depart IS NOT NULL THEN
        v_arrivee_timestamp := (p_date_arrivee || ' ' || p_heure_arrivee)::TIMESTAMP;
        v_depart_timestamp := (p_date_depart || ' ' || p_heure_depart)::TIMESTAMP;
    ELSE
        -- Pour réservations nightly, utiliser minuit
        v_arrivee_timestamp := p_date_arrivee::TIMESTAMP;
        v_depart_timestamp := (p_date_depart + INTERVAL '1 day')::TIMESTAMP;
    END IF;

    -- 1. Vérifier réservations (automatique) - avec support horaire
    SELECT COUNT(*)
    INTO v_conflicting_reservations
    FROM hotel_meuble_reservations
    WHERE property_id = p_property_id
    AND status IN ('pending', 'confirmed', 'checked_in')
    AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
    AND (
        -- Réservations nightly : chevauchement de dates
        (reservation_type = 'nightly' AND (
            (date_arrivee <= p_date_arrivee AND date_depart > p_date_arrivee)
            OR (date_arrivee < p_date_depart AND date_depart >= p_date_depart)
            OR (date_arrivee >= p_date_arrivee AND date_depart <= p_date_depart)
        ))
        OR
        -- Réservations horaires : chevauchement de créneaux
        (reservation_type = 'hourly' AND heure_arrivee IS NOT NULL AND heure_depart IS NOT NULL AND (
            -- Nouvelle réservation horaire
            (p_reservation_type = 'hourly' AND p_heure_arrivee IS NOT NULL AND p_heure_depart IS NOT NULL AND (
                -- Chevauchement : début dans le créneau existant
                ((date_arrivee || ' ' || heure_arrivee)::TIMESTAMP <= v_arrivee_timestamp 
                 AND (date_depart || ' ' || heure_depart)::TIMESTAMP > v_arrivee_timestamp)
                OR
                -- Chevauchement : fin dans le créneau existant
                ((date_arrivee || ' ' || heure_arrivee)::TIMESTAMP < v_depart_timestamp 
                 AND (date_depart || ' ' || heure_depart)::TIMESTAMP >= v_depart_timestamp)
                OR
                -- Nouvelle réservation englobe une existante
                ((date_arrivee || ' ' || heure_arrivee)::TIMESTAMP >= v_arrivee_timestamp 
                 AND (date_depart || ' ' || heure_depart)::TIMESTAMP <= v_depart_timestamp)
            ))
            OR
            -- Nouvelle réservation nightly chevauche une horaire
            (p_reservation_type = 'nightly' AND (
                date_arrivee <= p_date_arrivee AND date_depart > p_date_arrivee
                OR date_arrivee < p_date_depart AND date_depart >= p_date_depart
                OR date_arrivee >= p_date_arrivee AND date_depart <= p_date_depart
            ))
        )
    );
    
    -- 2. Vérifier blocages manuels (toujours par date, pas par heure)
    SELECT COUNT(*)
    INTO v_conflicting_blocks
    FROM hotel_availability_blocks
    WHERE property_id = p_property_id
    AND is_active = TRUE
    AND (
        (date_debut <= p_date_arrivee AND date_fin > p_date_arrivee)
        OR (date_debut < p_date_depart AND date_fin >= p_date_depart)
        OR (date_debut >= p_date_arrivee AND date_fin <= p_date_depart)
    );
    
    -- Disponible si pas de conflits
    RETURN (v_conflicting_reservations = 0 AND v_conflicting_blocks = 0);
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON COLUMN hotel_meuble_reservations.reservation_type IS 'Type de réservation: nightly (nuitées) ou hourly (horaires)';
COMMENT ON COLUMN hotel_meuble_reservations.heure_arrivee IS 'Heure d''arrivée pour réservations horaires (format HH:MM)';
COMMENT ON COLUMN hotel_meuble_reservations.heure_depart IS 'Heure de départ pour réservations horaires (format HH:MM)';
COMMENT ON COLUMN hotel_meuble_reservations.nombre_heures IS 'Nombre d''heures pour réservations horaires';
COMMENT ON COLUMN hotel_meuble_reservations.prix_heure IS 'Prix par heure au moment de la réservation';

