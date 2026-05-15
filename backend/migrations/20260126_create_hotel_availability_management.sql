-- ✅ NOUVEAU: Migration pour gestion disponibilité hôtels/meublés (hybride automatique/manuel)
-- Date: 2026-01-26
-- Description: Système de gestion de disponibilité avec blocages manuels et automatisation

-- Table pour blocages manuels de disponibilité
CREATE TABLE IF NOT EXISTS hotel_availability_blocks (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    
    -- Dates de blocage
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    
    -- Type de blocage
    block_type VARCHAR(50) NOT NULL, -- "maintenance", "renovation", "fermeture", "manual", "event"
    reason TEXT, -- Raison du blocage
    
    -- Gestion
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_block_dates CHECK (date_fin >= date_debut)
);

-- Index pour blocages
CREATE INDEX IF NOT EXISTS idx_hotel_blocks_property_id ON hotel_availability_blocks(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_blocks_service_id ON hotel_availability_blocks(service_id);
CREATE INDEX IF NOT EXISTS idx_hotel_blocks_dates ON hotel_availability_blocks(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_hotel_blocks_active ON hotel_availability_blocks(is_active) WHERE is_active = TRUE;

-- Table pour gestion multi-utilisateurs (gérants d'hôtels/meublés)
CREATE TABLE IF NOT EXISTS hotel_management_users (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rôle
    role VARCHAR(50) NOT NULL DEFAULT 'manager', -- "owner", "manager", "receptionist", "staff"
    permissions JSONB DEFAULT '{}', -- {"can_manage_availability": true, "can_manage_bookings": true, "can_manage_prices": false}
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_hotel_management_user UNIQUE(service_id, user_id)
);

-- Index pour gestion utilisateurs
CREATE INDEX IF NOT EXISTS idx_hotel_management_service_id ON hotel_management_users(service_id);
CREATE INDEX IF NOT EXISTS idx_hotel_management_user_id ON hotel_management_users(user_id);
CREATE INDEX IF NOT EXISTS idx_hotel_management_active ON hotel_management_users(is_active) WHERE is_active = TRUE;

-- Ajouter colonne niveau étoilé pour hôtels
ALTER TABLE real_estate_properties
ADD COLUMN IF NOT EXISTS hotel_star_rating INTEGER CHECK (hotel_star_rating >= 1 AND hotel_star_rating <= 5);

-- Index pour niveau étoilé
CREATE INDEX IF NOT EXISTS idx_real_estate_star_rating ON real_estate_properties(hotel_star_rating) WHERE hotel_star_rating IS NOT NULL;

-- Ajouter colonne Google Places ID
ALTER TABLE real_estate_properties
ADD COLUMN IF NOT EXISTS google_places_id VARCHAR(255);

-- Index pour Google Places ID
CREATE INDEX IF NOT EXISTS idx_real_estate_google_places_id ON real_estate_properties(google_places_id) WHERE google_places_id IS NOT NULL;

-- Fonction améliorée pour vérifier disponibilité (hybride automatique/manuel)
CREATE OR REPLACE FUNCTION check_hotel_availability_hybrid(
    p_property_id INTEGER,
    p_date_arrivee DATE,
    p_date_depart DATE,
    p_exclude_reservation_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_conflicting_reservations INTEGER;
    v_conflicting_blocks INTEGER;
BEGIN
    -- 1. Vérifier réservations (automatique)
    SELECT COUNT(*)
    INTO v_conflicting_reservations
    FROM hotel_meuble_reservations
    WHERE property_id = p_property_id
    AND status IN ('pending', 'confirmed', 'checked_in')
    AND (
        (date_arrivee <= p_date_arrivee AND date_depart > p_date_arrivee)
        OR (date_arrivee < p_date_depart AND date_depart >= p_date_depart)
        OR (date_arrivee >= p_date_arrivee AND date_depart <= p_date_depart)
    )
    AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id);
    
    -- 2. Vérifier blocages manuels
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

-- Vue pour calendrier de disponibilité (pour gérants)
CREATE OR REPLACE VIEW hotel_availability_calendar AS
SELECT 
    p.id as property_id,
    p.service_id,
    p.titre as property_name,
    date_series.date as calendar_date,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM hotel_meuble_reservations r
            WHERE r.property_id = p.id
            AND r.status IN ('pending', 'confirmed', 'checked_in')
            AND date_series.date >= r.date_arrivee
            AND date_series.date < r.date_depart
        ) THEN 'reserved'
        WHEN EXISTS (
            SELECT 1 FROM hotel_availability_blocks b
            WHERE b.property_id = p.id
            AND b.is_active = TRUE
            AND date_series.date >= b.date_debut
            AND date_series.date <= b.date_fin
        ) THEN 'blocked'
        ELSE 'available'
    END as availability_status
FROM real_estate_properties p
CROSS JOIN LATERAL generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '365 days',
    INTERVAL '1 day'
) as date_series(date)
WHERE p.type_bien IN ('hôtel', 'meublé')
AND p.is_active = TRUE;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_hotel_block_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hotel_block_updated_at
BEFORE UPDATE ON hotel_availability_blocks
FOR EACH ROW
EXECUTE FUNCTION update_hotel_block_updated_at();

CREATE TRIGGER trigger_hotel_management_updated_at
BEFORE UPDATE ON hotel_management_users
FOR EACH ROW
EXECUTE FUNCTION update_hotel_block_updated_at();

