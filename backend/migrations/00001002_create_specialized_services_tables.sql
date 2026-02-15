-- Tables pour services spécialisés (Santé et Transport)

-- ============================================================================
-- SERVICES SPÉCIALISÉS (Santé et Transport)
-- ============================================================================

-- GROUPE 1 : SANTÉ 🏥

-- Table pharmacies
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    jours_garde TEXT,
    heures_ouverture TIME,
    heures_fermeture TIME,
    permanent_24h BOOLEAN DEFAULT FALSE,
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    services TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_pharmacy_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON pharmacies(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_service_id ON pharmacies(service_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_on_duty ON pharmacies(is_on_duty_now) WHERE is_on_duty_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_ville ON pharmacies(ville);
CREATE INDEX IF NOT EXISTS idx_pharmacies_quartier ON pharmacies(quartier);
CREATE INDEX IF NOT EXISTS idx_pharmacies_services_gin ON pharmacies USING GIN(services);

-- Table hopitaux_cliniques
CREATE TABLE IF NOT EXISTS hopitaux_cliniques (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    prestations_medicales TEXT[],
    urgences_disponible BOOLEAN DEFAULT FALSE,
    rdv_en_ligne BOOLEAN DEFAULT FALSE,
    planning_hebdomadaire JSONB,
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_hospital_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_hopitaux_user_id ON hopitaux_cliniques(user_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_service_id ON hopitaux_cliniques(service_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_type ON hopitaux_cliniques(type_etablissement);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_active ON hopitaux_cliniques(is_active);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_available ON hopitaux_cliniques(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_hopitaux_prestations_gin ON hopitaux_cliniques USING GIN(prestations_medicales);
CREATE INDEX IF NOT EXISTS idx_hopitaux_planning_gin ON hopitaux_cliniques USING GIN(planning_hebdomadaire);

-- Table laboratoires_imagerie
CREATE TABLE IF NOT EXISTS laboratoires_imagerie (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type_laboratoire VARCHAR(50) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    analyses_disponibles TEXT[],
    imagerie_disponible TEXT[],
    planning_hebdomadaire JSONB,
    rdv_requis BOOLEAN DEFAULT TRUE,
    resultats_en_ligne BOOLEAN DEFAULT FALSE,
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_laboratory_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_laboratoires_user_id ON laboratoires_imagerie(user_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_service_id ON laboratoires_imagerie(service_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_type ON laboratoires_imagerie(type_laboratoire);
CREATE INDEX IF NOT EXISTS idx_laboratoires_analyses_gin ON laboratoires_imagerie USING GIN(analyses_disponibles);
CREATE INDEX IF NOT EXISTS idx_laboratoires_imagerie_gin ON laboratoires_imagerie USING GIN(imagerie_disponible);
CREATE INDEX IF NOT EXISTS idx_laboratoires_is_available ON laboratoires_imagerie(is_available_now) WHERE is_available_now = TRUE;

-- GROUPE 2 : TRANSPORT 🚗

-- Table agences_voyage
CREATE TABLE IF NOT EXISTS agences_voyage (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_agence VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    services_voyage TEXT[],
    compagnies_bus TEXT[],
    destinations TEXT[],
    heures_ouverture TIME,
    heures_fermeture TIME,
    jours_ouverture TEXT,
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    peut_emettre_tickets_bus BOOLEAN DEFAULT FALSE,
    compagnies_affiliees TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_agency_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_agences_user_id ON agences_voyage(user_id);
CREATE INDEX IF NOT EXISTS idx_agences_service_id ON agences_voyage(service_id);
CREATE INDEX IF NOT EXISTS idx_agences_tickets_bus ON agences_voyage(peut_emettre_tickets_bus) WHERE peut_emettre_tickets_bus = TRUE;
CREATE INDEX IF NOT EXISTS idx_agences_services_gin ON agences_voyage USING GIN(services_voyage);
CREATE INDEX IF NOT EXISTS idx_agences_compagnies_gin ON agences_voyage USING GIN(compagnies_bus);
CREATE INDEX IF NOT EXISTS idx_agences_destinations_gin ON agences_voyage USING GIN(destinations);

-- Table covoiturages
CREATE TABLE IF NOT EXISTS covoiturages (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    depart VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    gps_depart VARCHAR(255),
    gps_destination VARCHAR(255),
    date_depart TIMESTAMPTZ NOT NULL,
    heure_depart TIME NOT NULL,
    date_arrivee_estimee TIMESTAMPTZ,
    type_vehicule VARCHAR(50),
    marque_modele VARCHAR(255),
    nombre_places INTEGER NOT NULL,
    places_disponibles INTEGER NOT NULL,
    prix_par_place INTEGER NOT NULL,
    devise VARCHAR(3) DEFAULT 'XAF',
    bagages_autorises BOOLEAN DEFAULT TRUE,
    animaux_autorises BOOLEAN DEFAULT FALSE,
    fumeur_autorise BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    statut VARCHAR(20) NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'complet', 'annule', 'termine')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_covoiturage_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_covoiturages_user_id ON covoiturages(user_id);
CREATE INDEX IF NOT EXISTS idx_covoiturages_service_id ON covoiturages(service_id);
CREATE INDEX IF NOT EXISTS idx_covoiturages_date_depart ON covoiturages(date_depart) WHERE is_active = TRUE AND statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_statut ON covoiturages(statut) WHERE statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_depart_destination ON covoiturages(depart, destination);
CREATE INDEX IF NOT EXISTS idx_covoiturages_places_disponibles ON covoiturages(places_disponibles) WHERE places_disponibles > 0;

-- Table taxis_ville
CREATE TABLE IF NOT EXISTS taxis_ville (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_chauffeur VARCHAR(255),
    telephone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50),
    type_vehicule VARCHAR(50),
    marque_modele VARCHAR(255),
    immatriculation VARCHAR(50),
    couleur VARCHAR(50),
    annee INTEGER,
    is_available_now BOOLEAN DEFAULT FALSE,
    zone_intervention TEXT[],
    gps_actuel VARCHAR(255),
    tarif_base INTEGER DEFAULT 500,
    tarif_par_km INTEGER DEFAULT 200,
    devise VARCHAR(3) DEFAULT 'XAF',
    paiement_cash BOOLEAN DEFAULT TRUE,
    paiement_mobile_money BOOLEAN DEFAULT FALSE,
    paiement_carte BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    wifi BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_taxi_service UNIQUE(service_id)
);

CREATE INDEX IF NOT EXISTS idx_taxis_user_id ON taxis_ville(user_id);
CREATE INDEX IF NOT EXISTS idx_taxis_service_id ON taxis_ville(service_id);
CREATE INDEX IF NOT EXISTS idx_taxis_is_available ON taxis_ville(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_is_on_duty ON taxis_ville(is_on_duty) WHERE is_on_duty = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_zone_gin ON taxis_ville USING GIN(zone_intervention);

-- Fonction et triggers pour updated_at automatique
CREATE OR REPLACE FUNCTION update_specialized_service_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pharmacies_updated_at ON pharmacies;
CREATE TRIGGER trigger_pharmacies_updated_at BEFORE UPDATE ON pharmacies FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_hopitaux_updated_at ON hopitaux_cliniques;
CREATE TRIGGER trigger_hopitaux_updated_at BEFORE UPDATE ON hopitaux_cliniques FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_laboratoires_updated_at ON laboratoires_imagerie;
CREATE TRIGGER trigger_laboratoires_updated_at BEFORE UPDATE ON laboratoires_imagerie FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_agences_updated_at ON agences_voyage;
CREATE TRIGGER trigger_agences_updated_at BEFORE UPDATE ON agences_voyage FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_covoiturages_updated_at ON covoiturages;
CREATE TRIGGER trigger_covoiturages_updated_at BEFORE UPDATE ON covoiturages FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_taxis_updated_at ON taxis_ville;
CREATE TRIGGER trigger_taxis_updated_at BEFORE UPDATE ON taxis_ville FOR EACH ROW EXECUTE FUNCTION update_specialized_service_timestamp();

-- GROUPE 3 : BANQUES DE SANG 🩸

-- Table banques_sang
CREATE TABLE IF NOT EXISTS banques_sang (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lien avec établissement (optionnel, peut être indépendant)
    hopital_id INTEGER REFERENCES hopitaux_cliniques(id) ON DELETE SET NULL,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255), -- Format: "lat,lng"
    
    -- Groupes sanguins disponibles avec stocks
    stocks_groupes_sanguins JSONB NOT NULL DEFAULT '{}',
    
    -- Services
    accepte_dons BOOLEAN DEFAULT TRUE,
    accepte_demandes BOOLEAN DEFAULT TRUE,
    urgence_24h BOOLEAN DEFAULT FALSE,
    
    -- Planification
    planning_hebdomadaire JSONB,
    horaires_dons TIME[], -- ["08:00", "17:00"] - Horaires pour les dons
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_banque_service UNIQUE(service_id)
);

-- Index pour banques_sang
CREATE INDEX IF NOT EXISTS idx_banques_sang_user_id ON banques_sang(user_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_service_id ON banques_sang(service_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_hopital_id ON banques_sang(hopital_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_is_active ON banques_sang(is_active);
CREATE INDEX IF NOT EXISTS idx_banques_sang_is_available ON banques_sang(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_urgence_24h ON banques_sang(urgence_24h) WHERE urgence_24h = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_accepte_dons ON banques_sang(accepte_dons) WHERE accepte_dons = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_accepte_demandes ON banques_sang(accepte_demandes) WHERE accepte_demandes = TRUE;
CREATE INDEX IF NOT EXISTS idx_banques_sang_stocks_gin ON banques_sang USING GIN(stocks_groupes_sanguins);
CREATE INDEX IF NOT EXISTS idx_banques_sang_planning_gin ON banques_sang USING GIN(planning_hebdomadaire);
CREATE INDEX IF NOT EXISTS idx_banques_sang_ville ON banques_sang(ville);
CREATE INDEX IF NOT EXISTS idx_banques_sang_quartier ON banques_sang(quartier);

-- Index GPS (GIST pour recherche géographique)
CREATE INDEX IF NOT EXISTS idx_banques_sang_gps ON banques_sang USING GIST(
    CAST(ST_SetSRID(ST_MakePoint(
        CAST(SPLIT_PART(gps, ',', 2) AS DOUBLE PRECISION),
        CAST(SPLIT_PART(gps, ',', 1) AS DOUBLE PRECISION)
    ), 4326) AS geography)
) WHERE gps IS NOT NULL AND gps != '';

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_banques_sang_updated_at ON banques_sang;
CREATE TRIGGER update_banques_sang_updated_at 
    BEFORE UPDATE ON banques_sang 
    FOR EACH ROW 
    EXECUTE FUNCTION update_specialized_service_timestamp();

