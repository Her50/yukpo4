-- Migration: Créer tables pour services spécialisés (Santé et Transport)
-- Date: 2025-11-26
-- Description: Tables dédiées pour pharmacies, hôpitaux, laboratoires, agences de voyage, covoiturage, taxi
--              avec prise en compte systématique du moment (NOW()) pour recherche en temps réel
-- Note: Compatible avec SQLx offline mode (pas de SELECT retournant des résultats)

-- ============================================================================
-- GROUPE 1 : SANTÉ 🏥
-- ============================================================================

-- 1. Table pharmacies
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255), -- Format: "lat,lng"
    
    -- Planification
    jours_garde TEXT, -- "Lundi, Mercredi, Vendredi"
    heures_ouverture TIME,
    heures_fermeture TIME,
    permanent_24h BOOLEAN DEFAULT FALSE,
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Services
    services TEXT[], -- ["Garde", "Délivrance", "Conseil", "Vaccination"]
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_pharmacy_service UNIQUE(service_id)
);

-- Index pour pharmacies
CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON pharmacies(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_service_id ON pharmacies(service_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_on_duty ON pharmacies(is_on_duty_now) WHERE is_on_duty_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_ville ON pharmacies(ville);
CREATE INDEX IF NOT EXISTS idx_pharmacies_quartier ON pharmacies(quartier);
CREATE INDEX IF NOT EXISTS idx_pharmacies_services_gin ON pharmacies USING GIN(services);

-- Commentaires pharmacies
COMMENT ON TABLE pharmacies IS 'Pharmacies avec gestion de garde et disponibilité en temps réel';
COMMENT ON COLUMN pharmacies.is_on_duty_now IS 'Calculé automatiquement avec is_pharmacy_on_duty() et NOW()';

-- 2. Table hopitaux_cliniques
CREATE TABLE IF NOT EXISTS hopitaux_cliniques (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL, -- "Hôpital", "Clinique", "Dispensaire"
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Services médicaux
    prestations_medicales TEXT[], -- ["Chirurgie", "Pédiatrie", "Urgences", "Maternité"]
    banque_sang BOOLEAN DEFAULT FALSE,
    urgences_disponible BOOLEAN DEFAULT FALSE,
    rdv_en_ligne BOOLEAN DEFAULT FALSE,
    
    -- Planification hebdomadaire (JSONB pour flexibilité)
    planning_hebdomadaire JSONB, -- {"lundi": {"debut": "08:00", "fin": "18:00", "permanent": false}, ...}
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_hospital_service UNIQUE(service_id)
);

-- Index pour hopitaux_cliniques
CREATE INDEX IF NOT EXISTS idx_hopitaux_user_id ON hopitaux_cliniques(user_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_service_id ON hopitaux_cliniques(service_id);
CREATE INDEX IF NOT EXISTS idx_hopitaux_type ON hopitaux_cliniques(type_etablissement);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_active ON hopitaux_cliniques(is_active);
CREATE INDEX IF NOT EXISTS idx_hopitaux_is_available ON hopitaux_cliniques(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_hopitaux_prestations_gin ON hopitaux_cliniques USING GIN(prestations_medicales);
CREATE INDEX IF NOT EXISTS idx_hopitaux_planning_gin ON hopitaux_cliniques USING GIN(planning_hebdomadaire);

-- Commentaires hopitaux_cliniques
COMMENT ON TABLE hopitaux_cliniques IS 'Hôpitaux et cliniques avec gestion de disponibilité en temps réel';
COMMENT ON COLUMN hopitaux_cliniques.is_available_now IS 'Calculé automatiquement avec is_medical_service_available() et NOW()';

-- 3. Table laboratoires_imagerie
CREATE TABLE IF NOT EXISTS laboratoires_imagerie (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    type_laboratoire VARCHAR(50) NOT NULL, -- "Laboratoire", "Centre d'imagerie", "Les deux"
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Services
    analyses_disponibles TEXT[], -- ["Sang", "Urine", "Bactériologie", "Parasitologie"]
    imagerie_disponible TEXT[], -- ["Radiologie", "Échographie", "Scanner", "IRM"]
    
    -- Planification
    planning_hebdomadaire JSONB,
    rdv_requis BOOLEAN DEFAULT TRUE,
    resultats_en_ligne BOOLEAN DEFAULT FALSE,
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_laboratory_service UNIQUE(service_id)
);

-- Index pour laboratoires_imagerie
CREATE INDEX IF NOT EXISTS idx_laboratoires_user_id ON laboratoires_imagerie(user_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_service_id ON laboratoires_imagerie(service_id);
CREATE INDEX IF NOT EXISTS idx_laboratoires_type ON laboratoires_imagerie(type_laboratoire);
CREATE INDEX IF NOT EXISTS idx_laboratoires_analyses_gin ON laboratoires_imagerie USING GIN(analyses_disponibles);
CREATE INDEX IF NOT EXISTS idx_laboratoires_imagerie_gin ON laboratoires_imagerie USING GIN(imagerie_disponible);
CREATE INDEX IF NOT EXISTS idx_laboratoires_is_available ON laboratoires_imagerie(is_available_now) WHERE is_available_now = TRUE;

-- Commentaires laboratoires_imagerie
COMMENT ON TABLE laboratoires_imagerie IS 'Laboratoires et centres d''imagerie avec gestion de disponibilité en temps réel';
COMMENT ON COLUMN laboratoires_imagerie.is_available_now IS 'Calculé automatiquement avec planning_hebdomadaire et NOW()';

-- ============================================================================
-- GROUPE 2 : TRANSPORT 🚗
-- ============================================================================

-- 4. Table agences_voyage
CREATE TABLE IF NOT EXISTS agences_voyage (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom_agence VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Services
    services_voyage TEXT[], -- ["Réservation bus", "Billets avion", "Voyages organisés"]
    compagnies_bus TEXT[], -- ["Amour Mezam", "Camair-Co", "Voyages Express"]
    destinations TEXT[], -- ["Douala", "Yaoundé", "Bafoussam", "Garoua"]
    
    -- Horaires
    heures_ouverture TIME,
    heures_fermeture TIME,
    jours_ouverture TEXT, -- "Lundi-Samedi"
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Configuration bus (si applicable)
    peut_emettre_tickets_bus BOOLEAN DEFAULT FALSE,
    compagnies_affiliees TEXT[], -- Compagnies avec lesquelles l'agence travaille
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_agency_service UNIQUE(service_id)
);

-- Index pour agences_voyage
CREATE INDEX IF NOT EXISTS idx_agences_user_id ON agences_voyage(user_id);
CREATE INDEX IF NOT EXISTS idx_agences_service_id ON agences_voyage(service_id);
CREATE INDEX IF NOT EXISTS idx_agences_tickets_bus ON agences_voyage(peut_emettre_tickets_bus) WHERE peut_emettre_tickets_bus = TRUE;
CREATE INDEX IF NOT EXISTS idx_agences_services_gin ON agences_voyage USING GIN(services_voyage);
CREATE INDEX IF NOT EXISTS idx_agences_compagnies_gin ON agences_voyage USING GIN(compagnies_bus);
CREATE INDEX IF NOT EXISTS idx_agences_destinations_gin ON agences_voyage USING GIN(destinations);

-- Commentaires agences_voyage
COMMENT ON TABLE agences_voyage IS 'Agences de voyage pour réservation de tickets bus et autres services';

-- 5. Table covoiturages
CREATE TABLE IF NOT EXISTS covoiturages (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations trajet
    depart VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    gps_depart VARCHAR(255), -- Format: "lat,lng"
    gps_destination VARCHAR(255), -- Format: "lat,lng"
    
    -- Date et heure
    date_depart TIMESTAMPTZ NOT NULL,
    heure_depart TIME NOT NULL,
    date_arrivee_estimee TIMESTAMPTZ,
    
    -- Véhicule
    type_vehicule VARCHAR(50), -- "Voiture", "Moto", "Camionnette"
    marque_modele VARCHAR(255),
    nombre_places INTEGER NOT NULL,
    places_disponibles INTEGER NOT NULL,
    
    -- Prix
    prix_par_place INTEGER NOT NULL, -- FCFA
    devise VARCHAR(3) DEFAULT 'XAF',
    
    -- Options
    bagages_autorises BOOLEAN DEFAULT TRUE,
    animaux_autorises BOOLEAN DEFAULT FALSE,
    fumeur_autorise BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    
    -- Statut
    statut VARCHAR(20) NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'complet', 'annule', 'termine')),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_covoiturage_service UNIQUE(service_id)
);

-- Index pour covoiturages (avec moment)
CREATE INDEX IF NOT EXISTS idx_covoiturages_user_id ON covoiturages(user_id);
CREATE INDEX IF NOT EXISTS idx_covoiturages_service_id ON covoiturages(service_id);
CREATE INDEX IF NOT EXISTS idx_covoiturages_date_depart ON covoiturages(date_depart) WHERE is_active = TRUE AND statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_statut ON covoiturages(statut) WHERE statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_covoiturages_depart_destination ON covoiturages(depart, destination);
CREATE INDEX IF NOT EXISTS idx_covoiturages_places_disponibles ON covoiturages(places_disponibles) WHERE places_disponibles > 0;

-- Commentaires covoiturages
COMMENT ON TABLE covoiturages IS 'Trajets de covoiturage avec recherche par moment (disponibles maintenant ou prochaines heures)';
COMMENT ON COLUMN covoiturages.date_depart IS 'Date et heure de départ pour recherche avec moment (NOW())';

-- 6. Table taxis_ville
CREATE TABLE IF NOT EXISTS taxis_ville (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations chauffeur
    nom_chauffeur VARCHAR(255),
    telephone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50),
    
    -- Véhicule
    type_vehicule VARCHAR(50), -- "Berline", "SUV", "Van", "Moto"
    marque_modele VARCHAR(255),
    immatriculation VARCHAR(50),
    couleur VARCHAR(50),
    annee INTEGER,
    
    -- Disponibilité
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    zone_intervention TEXT[], -- ["Douala Centre", "Bonanjo", "Akwa"]
    gps_actuel VARCHAR(255), -- Position actuelle du taxi (Format: "lat,lng")
    
    -- Tarification
    tarif_base INTEGER DEFAULT 500, -- FCFA (prix minimum)
    tarif_par_km INTEGER DEFAULT 200, -- FCFA par km
    devise VARCHAR(3) DEFAULT 'XAF',
    
    -- Options
    paiement_cash BOOLEAN DEFAULT TRUE,
    paiement_mobile_money BOOLEAN DEFAULT FALSE,
    paiement_carte BOOLEAN DEFAULT FALSE,
    climatisation BOOLEAN DEFAULT FALSE,
    wifi BOOLEAN DEFAULT FALSE,
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_on_duty BOOLEAN DEFAULT FALSE, -- En service maintenant
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_taxi_service UNIQUE(service_id)
);

-- Index pour taxis_ville (avec moment)
CREATE INDEX IF NOT EXISTS idx_taxis_user_id ON taxis_ville(user_id);
CREATE INDEX IF NOT EXISTS idx_taxis_service_id ON taxis_ville(service_id);
CREATE INDEX IF NOT EXISTS idx_taxis_is_available ON taxis_ville(is_available_now) WHERE is_available_now = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_is_on_duty ON taxis_ville(is_on_duty) WHERE is_on_duty = TRUE;
CREATE INDEX IF NOT EXISTS idx_taxis_zone_gin ON taxis_ville USING GIN(zone_intervention);

-- Commentaires taxis_ville
COMMENT ON TABLE taxis_ville IS 'Taxis de ville (comme Yango/Uber) avec disponibilité en temps réel';
COMMENT ON COLUMN taxis_ville.is_available_now IS 'Calculé automatiquement avec NOW() pour recherche en temps réel';
COMMENT ON COLUMN taxis_ville.gps_actuel IS 'Position GPS actuelle du taxi pour recherche de proximité';

-- ============================================================================
-- TRIGGERS POUR updated_at AUTOMATIQUE
-- ============================================================================

-- Fonction générique pour updated_at
CREATE OR REPLACE FUNCTION update_specialized_service_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour chaque table
DROP TRIGGER IF EXISTS trigger_pharmacies_updated_at ON pharmacies;
CREATE TRIGGER trigger_pharmacies_updated_at
    BEFORE UPDATE ON pharmacies
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_hopitaux_updated_at ON hopitaux_cliniques;
CREATE TRIGGER trigger_hopitaux_updated_at
    BEFORE UPDATE ON hopitaux_cliniques
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_laboratoires_updated_at ON laboratoires_imagerie;
CREATE TRIGGER trigger_laboratoires_updated_at
    BEFORE UPDATE ON laboratoires_imagerie
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_agences_updated_at ON agences_voyage;
CREATE TRIGGER trigger_agences_updated_at
    BEFORE UPDATE ON agences_voyage
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_covoiturages_updated_at ON covoiturages;
CREATE TRIGGER trigger_covoiturages_updated_at
    BEFORE UPDATE ON covoiturages
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_service_timestamp();

DROP TRIGGER IF EXISTS trigger_taxis_updated_at ON taxis_ville;
CREATE TRIGGER trigger_taxis_updated_at
    BEFORE UPDATE ON taxis_ville
    FOR EACH ROW
    EXECUTE FUNCTION update_specialized_service_timestamp();

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================

-- ✅ Compatible SQLx offline mode :
--    - Pas de SELECT retournant des résultats
--    - Utilisation de DO $$ blocks pour vérifications
--    - CREATE TABLE IF NOT EXISTS
--    - CREATE INDEX IF NOT EXISTS
--    - CREATE OR REPLACE FUNCTION

-- ✅ Prise en compte du moment (NOW()) :
--    - is_on_duty_now (pharmacies) : Calculé avec is_pharmacy_on_duty() et NOW()
--    - is_available_now (hôpitaux, laboratoires, taxis) : Calculé avec NOW()
--    - date_depart (covoiturages) : Filtre pour trajets disponibles maintenant/prochaines heures
--    - is_on_duty (taxis) : En service maintenant

-- ✅ Cohérence avec tables existantes :
--    - Références users(id) ON DELETE CASCADE
--    - Références services(id) ON DELETE CASCADE
--    - Format GPS : "lat,lng" (cohérent avec services.gps)
--    - Timestamps : TIMESTAMPTZ (cohérent avec services.created_at)

