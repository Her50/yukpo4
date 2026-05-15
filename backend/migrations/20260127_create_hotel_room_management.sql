-- ✅ NOUVEAU: Migration pour gestion complète des chambres/unités hôtels et meublés
-- Date: 2026-01-27
-- Description: Système de gestion des chambres/studios/appartements avec QR codes et multi-biens

-- Table pour les unités (chambres/studios/appartements) d'un bien immobilier
CREATE TABLE IF NOT EXISTS hotel_meuble_units (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    
    -- Identification de l'unité
    unit_number VARCHAR(50) NOT NULL, -- Ex: "101", "Chambre 1", "Studio A"
    unit_type VARCHAR(50) NOT NULL, -- "chambre", "studio", "appartement", "suite", "villa"
    standing VARCHAR(50), -- "standard", "superior", "deluxe", "premium", "luxury"
    
    -- Capacité
    capacite_max_adultes INTEGER NOT NULL DEFAULT 2,
    capacite_max_enfants INTEGER DEFAULT 0,
    capacite_max_total INTEGER GENERATED ALWAYS AS (capacite_max_adultes + COALESCE(capacite_max_enfants, 0)) STORED,
    
    -- Caractéristiques
    superficie_m2 DECIMAL(8, 2),
    equipements JSONB DEFAULT '[]'::jsonb, -- ["Wi-Fi", "TV", "Climatisation", "Minibar", ...]
    photos TEXT[], -- URLs des photos de l'unité
    
    -- Prix (peut être différent du prix du bien principal)
    prix_nuitee DECIMAL(10, 2), -- Prix par nuitée pour cette unité (si différent)
    prix_heure DECIMAL(10, 2), -- Prix par heure pour cette unité (si différent)
    
    -- Statut
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE, -- Disponibilité générale
    
    -- Métadonnées
    notes TEXT, -- Notes internes pour le gérant
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT check_capacite CHECK (capacite_max_adultes > 0),
    CONSTRAINT unique_property_unit_number UNIQUE (property_id, unit_number)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_hotel_units_property_id ON hotel_meuble_units(property_id);
CREATE INDEX IF NOT EXISTS idx_hotel_units_type ON hotel_meuble_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_hotel_units_standing ON hotel_meuble_units(standing);
CREATE INDEX IF NOT EXISTS idx_hotel_units_available ON hotel_meuble_units(property_id, is_active, is_available) WHERE is_active = TRUE AND is_available = TRUE;

-- Table pour les blocages d'unités (maintenance, nettoyage, occupation manuelle, etc.)
CREATE TABLE IF NOT EXISTS hotel_unit_blockages (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER NOT NULL REFERENCES hotel_meuble_units(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    
    -- Période de blocage
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    heure_debut TIME, -- Optionnel pour blocages horaires
    heure_fin TIME, -- Optionnel pour blocages horaires
    
    -- Raison
    raison VARCHAR(100) NOT NULL, -- "maintenance", "nettoyage", "renovation", "occupation_manuelle", "reservation_hors_app", "autre"
    description TEXT,
    
    -- ✅ NOUVEAU: Pour occupation manuelle (hors système)
    is_manual_occupation BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE si occupation manuelle (hors système)
    client_name VARCHAR(255), -- Nom du client si occupation manuelle
    client_phone VARCHAR(50), -- Téléphone client si occupation manuelle
    notes_occupation TEXT, -- Notes sur l'occupation manuelle
    
    -- Métadonnées
    created_by INTEGER REFERENCES users(id), -- Gérant qui a créé le blocage
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT check_blockage_dates CHECK (date_fin >= date_debut)
);

-- Index pour blocages
CREATE INDEX IF NOT EXISTS idx_unit_blockages_unit_id ON hotel_unit_blockages(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_blockages_property_id ON hotel_unit_blockages(property_id);
CREATE INDEX IF NOT EXISTS idx_unit_blockages_dates ON hotel_unit_blockages(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_unit_blockages_manual ON hotel_unit_blockages(property_id, is_manual_occupation, date_debut, date_fin) WHERE is_manual_occupation = TRUE;

-- Ajouter colonnes pour numéro de chambre dans réservations
ALTER TABLE hotel_meuble_reservations
ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES hotel_meuble_units(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS unit_number VARCHAR(50), -- Numéro de chambre assigné (copie pour historique)
ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255) UNIQUE, -- Code QR unique pour cette réservation
ADD COLUMN IF NOT EXISTS qr_code_expires_at TIMESTAMPTZ, -- Expiration du QR code (après check-out)

-- Colonnes pour multi-biens (gérant avec plusieurs propriétés)
ADD COLUMN IF NOT EXISTS property_group_id INTEGER, -- ID du groupe de propriétés (si plusieurs biens)
ADD COLUMN IF NOT EXISTS property_location_name VARCHAR(255), -- Nom de l'emplacement (ex: "Hôtel Centre-Ville", "Résidence Plage")

-- ✅ NOUVEAU: Colonnes pour réservations manuelles (hors application)
ADD COLUMN IF NOT EXISTS is_manual_reservation BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE si créée manuellement par gérant
ADD COLUMN IF NOT EXISTS manual_reservation_source VARCHAR(100), -- "telephone", "en_personne", "autre_plateforme", "autre"
ADD COLUMN IF NOT EXISTS manual_reservation_notes TEXT; -- Notes sur la réservation manuelle

-- Index pour QR codes
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_qr_code ON hotel_meuble_reservations(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_unit_id ON hotel_meuble_reservations(unit_id);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_unit_number ON hotel_meuble_reservations(unit_number);

-- Table pour groupes de propriétés (multi-biens)
CREATE TABLE IF NOT EXISTS hotel_property_groups (
    id SERIAL PRIMARY KEY,
    partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE, -- Gérant/hôtelier
    
    -- Informations du groupe
    group_name VARCHAR(255) NOT NULL, -- Ex: "Hôtel XYZ Group"
    description TEXT,
    logo_url TEXT, -- Logo du groupe
    
    -- Informations fiscales (pour factures)
    company_name VARCHAR(255), -- Raison sociale
    tax_id VARCHAR(100), -- Numéro fiscal
    address TEXT, -- Adresse fiscale
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Métadonnées
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table de liaison propriétés <-> groupes
CREATE TABLE IF NOT EXISTS hotel_property_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES hotel_property_groups(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    
    -- Informations spécifiques à cette propriété dans le groupe
    location_name VARCHAR(255), -- Nom de l'emplacement (ex: "Centre-Ville", "Plage")
    location_address TEXT, -- Adresse complète
    location_gps VARCHAR(100), -- Coordonnées GPS
    
    -- Ordre d'affichage
    display_order INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contrainte unique
    CONSTRAINT unique_group_property UNIQUE (group_id, property_id)
);

-- Index pour groupes
CREATE INDEX IF NOT EXISTS idx_property_groups_partner_id ON hotel_property_groups(partner_id);
CREATE INDEX IF NOT EXISTS idx_property_group_members_group_id ON hotel_property_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_property_group_members_property_id ON hotel_property_group_members(property_id);

-- Table pour configuration formulaire client personnalisé
CREATE TABLE IF NOT EXISTS hotel_client_form_configs (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES hotel_property_groups(id) ON DELETE CASCADE,
    
    -- Configuration du formulaire
    form_fields JSONB NOT NULL DEFAULT '[]'::jsonb, -- Champs personnalisés
    required_fields TEXT[], -- Champs obligatoires
    default_values JSONB DEFAULT '{}'::jsonb, -- Valeurs par défaut
    
    -- Informations pour impression PDF
    logo_url TEXT, -- Logo pour facture/fiche
    header_text TEXT, -- Texte d'en-tête personnalisé
    footer_text TEXT, -- Texte de pied de page
    company_info JSONB DEFAULT '{}'::jsonb, -- Infos fiscales/références
    
    -- Métadonnées
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contrainte: soit property_id soit group_id doit être défini
    CONSTRAINT check_form_config_scope CHECK (
        (property_id IS NOT NULL AND group_id IS NULL) OR
        (property_id IS NULL AND group_id IS NOT NULL)
    )
);

-- Index pour configurations formulaire
CREATE INDEX IF NOT EXISTS idx_form_configs_property_id ON hotel_client_form_configs(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_configs_group_id ON hotel_client_form_configs(group_id) WHERE group_id IS NOT NULL;

-- Table pour données client sauvegardées (pré-remplissage)
CREATE TABLE IF NOT EXISTS hotel_client_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations client
    nom_complet VARCHAR(255),
    prenom VARCHAR(100),
    nom_famille VARCHAR(100),
    date_naissance DATE,
    lieu_naissance VARCHAR(255),
    nationalite VARCHAR(100),
    type_piece_identite VARCHAR(50), -- "CNI", "Passeport", "Permis", etc.
    numero_piece_identite VARCHAR(100),
    date_expiration_piece DATE,
    
    -- Coordonnées
    telephone VARCHAR(50),
    email VARCHAR(255),
    adresse TEXT,
    ville VARCHAR(100),
    pays VARCHAR(100),
    
    -- Préférences
    preferences JSONB DEFAULT '{}'::jsonb, -- Préférences (étage, vue, etc.)
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contrainte unique par utilisateur
    CONSTRAINT unique_user_client_profile UNIQUE (user_id)
);

-- Index pour profils client
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id ON hotel_client_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_email ON hotel_client_profiles(email) WHERE email IS NOT NULL;

-- Fonction pour générer QR code unique
CREATE OR REPLACE FUNCTION generate_reservation_qr_code(p_reservation_id INTEGER)
RETURNS VARCHAR(255) AS $$
DECLARE
    v_qr_code VARCHAR(255);
BEGIN
    -- Format: RES-{reservation_id}-{timestamp}-{random}
    v_qr_code := 'RES-' || p_reservation_id || '-' || 
                 EXTRACT(EPOCH FROM NOW())::BIGINT || '-' ||
                 LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    RETURN v_qr_code;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour assigner automatiquement une unité disponible
CREATE OR REPLACE FUNCTION assign_available_unit(
    p_property_id INTEGER,
    p_date_arrivee DATE,
    p_date_depart DATE,
    p_nombre_adultes INTEGER,
    p_nombre_enfants INTEGER DEFAULT 0,
    p_unit_type VARCHAR(50) DEFAULT NULL,
    p_standing VARCHAR(50) DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_unit_id INTEGER;
    v_capacite_requise INTEGER;
BEGIN
    v_capacite_requise := p_nombre_adultes + COALESCE(p_nombre_enfants, 0);
    
    -- Chercher une unité disponible qui correspond aux critères
    SELECT u.id INTO v_unit_id
    FROM hotel_meuble_units u
    WHERE u.property_id = p_property_id
        AND u.is_active = TRUE
        AND u.is_available = TRUE
        AND u.capacite_max_total >= v_capacite_requise
        AND (p_unit_type IS NULL OR u.unit_type = p_unit_type)
        AND (p_standing IS NULL OR u.standing = p_standing)
        -- Vérifier qu'elle n'est pas réservée pendant cette période
        AND NOT EXISTS (
            SELECT 1 FROM hotel_meuble_reservations r
            WHERE r.unit_id = u.id
                AND r.status IN ('pending', 'confirmed', 'checked_in')
                AND r.date_arrivee < p_date_depart
                AND r.date_depart > p_date_arrivee
        )
        -- Vérifier qu'elle n'est pas bloquée pendant cette période (inclut occupations manuelles)
        AND NOT EXISTS (
            SELECT 1 FROM hotel_unit_blockages b
            WHERE b.unit_id = u.id
                AND b.date_debut <= p_date_depart
                AND b.date_fin >= p_date_arrivee
        )
    ORDER BY 
        -- Prioriser les unités avec la capacité la plus proche
        ABS(u.capacite_max_total - v_capacite_requise),
        -- Puis par standing (si spécifié)
        CASE WHEN p_standing IS NOT NULL AND u.standing = p_standing THEN 0 ELSE 1 END,
        u.id
    LIMIT 1;
    
    RETURN v_unit_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_hotel_unit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hotel_unit_updated_at
BEFORE UPDATE ON hotel_meuble_units
FOR EACH ROW
EXECUTE FUNCTION update_hotel_unit_updated_at();

-- Vue pour disponibilité des unités
CREATE OR REPLACE VIEW hotel_unit_availability AS
SELECT 
    u.id as unit_id,
    u.property_id,
    u.unit_number,
    u.unit_type,
    u.standing,
    u.capacite_max_total,
    u.is_active,
    u.is_available,
    -- Vérifier disponibilité pour aujourd'hui
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM hotel_meuble_reservations r
            WHERE r.unit_id = u.id
                AND r.status IN ('pending', 'confirmed', 'checked_in')
                AND CURRENT_DATE BETWEEN r.date_arrivee AND r.date_depart
        ) THEN FALSE
        WHEN EXISTS (
            SELECT 1 FROM hotel_unit_blockages b
            WHERE b.unit_id = u.id
                AND CURRENT_DATE BETWEEN b.date_debut AND b.date_fin
        ) THEN FALSE
        -- Vérifier aussi les occupations manuelles
        WHEN EXISTS (
            SELECT 1 FROM hotel_unit_blockages b
            WHERE b.unit_id = u.id
                AND b.is_manual_occupation = TRUE
                AND CURRENT_DATE BETWEEN b.date_debut AND b.date_fin
        ) THEN FALSE
        ELSE u.is_available
    END as available_today,
    -- Prochaine réservation
    (SELECT MIN(r.date_arrivee) 
     FROM hotel_meuble_reservations r
     WHERE r.unit_id = u.id
         AND r.status IN ('pending', 'confirmed')
         AND r.date_arrivee > CURRENT_DATE
    ) as next_reservation_date
FROM hotel_meuble_units u;

-- Commentaires
COMMENT ON TABLE hotel_meuble_units IS 'Unités (chambres/studios/appartements) des biens hôtels/meublés';
COMMENT ON TABLE hotel_unit_blockages IS 'Blocages temporaires d''unités (maintenance, nettoyage)';
COMMENT ON TABLE hotel_property_groups IS 'Groupes de propriétés pour gérants multi-biens';
COMMENT ON TABLE hotel_client_form_configs IS 'Configuration personnalisée des formulaires client';
COMMENT ON TABLE hotel_client_profiles IS 'Profils client sauvegardés pour pré-remplissage';

