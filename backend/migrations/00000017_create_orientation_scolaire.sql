-- Migration : Création des tables pour le système d'orientation scolaire et d'information sur les établissements
-- Date : 2025-01-28

-- Extension PostGIS pour géolocalisation (déjà créée normalement, mais on vérifie)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table : etablissements_scolaires
CREATE TABLE IF NOT EXISTS etablissements_scolaires (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations générales
    nom_etablissement VARCHAR(255) NOT NULL,
    type_etablissement VARCHAR(50) NOT NULL CHECK (type_etablissement IN ('primaire', 'secondaire', 'superieur')),
    sous_type VARCHAR(50), -- 'ecole_formation', 'universite', 'institut', etc. pour supérieur
    niveau_min INTEGER, -- Classe/niveau minimum
    niveau_max INTEGER, -- Classe/niveau maximum
    
    -- Localisation
    adresse TEXT,
    quartier VARCHAR(100),
    ville VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    gps VARCHAR(50), -- Format: "lat,lng"
    location_point GEOGRAPHY(POINT, 4326), -- Index spatial
    
    -- Contact
    telephone VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Informations académiques
    filieres TEXT[], -- Filières disponibles (pour secondaire/supérieur)
    specialites TEXT[], -- Spécialités (pour supérieur)
    langues_enseignement TEXT[], -- Langues d'enseignement
    
    -- Statistiques examens (JSON)
    statistiques_examens JSONB DEFAULT '{}'::jsonb, -- Agrégation: {"annee": {"taux_reussite": 85.5, "nb_candidats": 120, ...}}
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false, -- Vérification par admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT unique_service_etablissement UNIQUE (service_id)
);

-- Index pour recherche géographique
CREATE INDEX IF NOT EXISTS idx_etablissements_location ON etablissements_scolaires USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_etablissements_type_ville ON etablissements_scolaires(type_etablissement, ville);
CREATE INDEX IF NOT EXISTS idx_etablissements_filieres ON etablissements_scolaires USING GIN(filieres);
CREATE INDEX IF NOT EXISTS idx_etablissements_specialites ON etablissements_scolaires USING GIN(specialites);
CREATE INDEX IF NOT EXISTS idx_etablissements_active ON etablissements_scolaires(is_active, is_verified) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_etablissements_type_ville_active ON etablissements_scolaires(type_etablissement, ville, is_active) WHERE is_active = true AND is_verified = true;
CREATE INDEX IF NOT EXISTS idx_etablissements_stats ON etablissements_scolaires USING GIN(statistiques_examens);

-- Table : programmes_scolaires
-- Note: Si une ancienne version existe, elle sera remplacée par cette nouvelle structure
DO $$
BEGIN
    -- Supprimer l'ancienne table si elle existe avec l'ancienne structure
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'programmes_scolaires' 
        AND table_schema = 'public'
        AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'programmes_scolaires' 
            AND column_name = 'etablissement_id'
        )
    ) THEN
        DROP TABLE IF EXISTS programmes_scolaires CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS programmes_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Identification du programme
    type_etablissement VARCHAR(50) NOT NULL, -- 'primaire', 'secondaire', 'superieur'
    niveau VARCHAR(50) NOT NULL, -- 'CP1', '6ème', 'L1', etc.
    classe VARCHAR(50), -- Pour primaire/secondaire
    filiere VARCHAR(100), -- Pour secondaire/supérieur
    specialite VARCHAR(100), -- Pour supérieur
    
    -- Contenu
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    annee_scolaire VARCHAR(20) NOT NULL, -- '2024-2025'
    
    -- Fichier
    fichier_url TEXT, -- URL du fichier PDF/document
    fichier_nom VARCHAR(255),
    fichier_taille INTEGER, -- Taille en bytes
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- Note: Contrainte unique gérée au niveau application (filiere peut être NULL)
);

CREATE INDEX IF NOT EXISTS idx_programmes_etablissement ON programmes_scolaires(etablissement_id, is_active);
CREATE INDEX IF NOT EXISTS idx_programmes_type_niveau ON programmes_scolaires(type_etablissement, niveau);
CREATE INDEX IF NOT EXISTS idx_programmes_annee ON programmes_scolaires(annee_scolaire);

-- Table : fournitures_scolaires
CREATE TABLE IF NOT EXISTS fournitures_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Identification
    type_etablissement VARCHAR(50) NOT NULL CHECK (type_etablissement IN ('primaire', 'secondaire')),
    niveau VARCHAR(50) NOT NULL, -- 'CP1', '6ème', etc.
    classe VARCHAR(50),
    
    -- Contenu
    annee_scolaire VARCHAR(20) NOT NULL,
    liste_fournitures JSONB NOT NULL, -- [{"nom": "Cahier", "quantite": 5, "remarque": "21x29.7"}, ...]
    
    -- Fichier
    fichier_url TEXT, -- URL du fichier PDF
    fichier_nom VARCHAR(255),
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT unique_etablissement_classe_annee UNIQUE (etablissement_id, niveau, annee_scolaire)
);

CREATE INDEX IF NOT EXISTS idx_fournitures_etablissement ON fournitures_scolaires(etablissement_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fournitures_type_niveau ON fournitures_scolaires(type_etablissement, niveau);

-- Table : concours_entree
CREATE TABLE IF NOT EXISTS concours_entree (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Informations concours
    nom_concours VARCHAR(255) NOT NULL,
    description TEXT,
    filiere VARCHAR(100), -- Filière concernée
    specialite VARCHAR(100), -- Spécialité concernée
    
    -- Dates
    date_ouverture_inscription DATE NOT NULL,
    date_fermeture_inscription DATE NOT NULL,
    date_concours DATE NOT NULL,
    date_resultats DATE, -- Date prévisionnelle
    
    -- Documentation
    documentation_url TEXT, -- URL du fichier PDF
    documentation_nom VARCHAR(255),
    programme_concours TEXT, -- Contenu du programme
    
    -- Conditions
    conditions_admission TEXT,
    frais_inscription DECIMAL(10, 2),
    nombre_places INTEGER,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_concours_etablissement ON concours_entree(etablissement_id, is_active);
-- Index partiel pour concours à venir (sans WHERE car CURRENT_DATE n'est pas IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_concours_dates ON concours_entree(date_concours, is_active);
CREATE INDEX IF NOT EXISTS idx_concours_filiere ON concours_entree(filiere, is_active);

-- Table : experiences_anciens_etudiants
CREATE TABLE IF NOT EXISTS experiences_anciens_etudiants (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations expérience
    filiere VARCHAR(100) NOT NULL,
    specialite VARCHAR(100),
    annee_entree INTEGER NOT NULL,
    annee_sortie INTEGER,
    niveau_obtenu VARCHAR(50), -- 'Licence', 'Master', etc.
    
    -- Contenu
    titre VARCHAR(255) NOT NULL,
    contenu TEXT NOT NULL,
    points_positifs TEXT[],
    points_negatifs TEXT[],
    note_generale INTEGER CHECK (note_generale >= 1 AND note_generale <= 5),
    
    -- Métadonnées
    is_verified BOOLEAN DEFAULT false, -- Vérification par admin
    is_approved BOOLEAN DEFAULT true, -- Approuvé pour publication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_experiences_etablissement ON experiences_anciens_etudiants(etablissement_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_experiences_filiere ON experiences_anciens_etudiants(filiere, is_approved);
CREATE INDEX IF NOT EXISTS idx_experiences_user ON experiences_anciens_etudiants(user_id);

-- Table : conferences_lives_scolaires
CREATE TABLE IF NOT EXISTS conferences_lives_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations conférence
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    type_conference VARCHAR(50) NOT NULL CHECK (type_conference IN ('orientation', 'information', 'concours', 'temoignage')),
    
    -- Programmation
    date_programmee TIMESTAMP WITH TIME ZONE NOT NULL,
    duree_estimee INTEGER, -- En minutes
    is_live BOOLEAN DEFAULT true,
    
    -- LiveKit
    room_name VARCHAR(255),
    room_token TEXT,
    livekit_url TEXT,
    
    -- Participants
    nombre_participants INTEGER DEFAULT 0,
    nombre_max_participants INTEGER,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_annule BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conferences_etablissement ON conferences_lives_scolaires(etablissement_id, is_active);
-- Index partiel pour conférences à venir (sans WHERE car CURRENT_TIMESTAMP n'est pas IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_conferences_date ON conferences_lives_scolaires(date_programmee, is_active);
CREATE INDEX IF NOT EXISTS idx_conferences_type ON conferences_lives_scolaires(type_conference, is_active);

-- Table : suggestions_orientation (Cache des suggestions)
CREATE TABLE IF NOT EXISTS suggestions_orientation (
    id SERIAL PRIMARY KEY,
    
    -- Critères de recherche
    type_etablissement VARCHAR(50) NOT NULL,
    domaine VARCHAR(100), -- Domaine d'étude
    filiere VARCHAR(100),
    ville VARCHAR(100),
    region VARCHAR(100),
    
    -- Résultats agrégés
    etablissements_suggerees INTEGER[], -- IDs des établissements
    scores JSONB, -- {"etablissement_id": score, ...}
    criteres_utilises JSONB, -- Critères utilisés pour le calcul
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL -- Expiration du cache
);

CREATE INDEX IF NOT EXISTS idx_suggestions_criteres ON suggestions_orientation(type_etablissement, domaine, filiere, ville, region);
-- Index pour suggestions (sans WHERE car CURRENT_TIMESTAMP n'est pas IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_suggestions_expires ON suggestions_orientation(expires_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_domain_filiere ON suggestions_orientation(domaine, filiere, ville);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_etablissements_scolaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_etablissements_scolaires_updated_at
    BEFORE UPDATE ON etablissements_scolaires
    FOR EACH ROW
    EXECUTE FUNCTION update_etablissements_scolaires_updated_at();

CREATE OR REPLACE FUNCTION update_programmes_scolaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_programmes_scolaires_updated_at
    BEFORE UPDATE ON programmes_scolaires
    FOR EACH ROW
    EXECUTE FUNCTION update_programmes_scolaires_updated_at();

CREATE OR REPLACE FUNCTION update_fournitures_scolaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fournitures_scolaires_updated_at
    BEFORE UPDATE ON fournitures_scolaires
    FOR EACH ROW
    EXECUTE FUNCTION update_fournitures_scolaires_updated_at();

CREATE OR REPLACE FUNCTION update_concours_entree_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_concours_entree_updated_at
    BEFORE UPDATE ON concours_entree
    FOR EACH ROW
    EXECUTE FUNCTION update_concours_entree_updated_at();

CREATE OR REPLACE FUNCTION update_experiences_anciens_etudiants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_experiences_anciens_etudiants_updated_at
    BEFORE UPDATE ON experiences_anciens_etudiants
    FOR EACH ROW
    EXECUTE FUNCTION update_experiences_anciens_etudiants_updated_at();

CREATE OR REPLACE FUNCTION update_conferences_lives_scolaires_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conferences_lives_scolaires_updated_at
    BEFORE UPDATE ON conferences_lives_scolaires
    FOR EACH ROW
    EXECUTE FUNCTION update_conferences_lives_scolaires_updated_at();

