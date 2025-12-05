-- Migration : Création des tables pour le système d'offres d'emploi avec matching intelligent
-- Date : 2025-01-28

-- Extension PostGIS pour géolocalisation (déjà créée normalement, mais on vérifie)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table : offres_emploi
CREATE TABLE IF NOT EXISTS offres_emploi (
    id SERIAL PRIMARY KEY,
    entreprise_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations générales
    titre_poste VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type_contrat VARCHAR(50) NOT NULL CHECK (type_contrat IN ('CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance')),
    duree_contrat INTEGER, -- En mois (pour CDD)
    
    -- Localisation
    lieu_travail VARCHAR(255) NOT NULL, -- Ville, quartier
    adresse TEXT,
    gps VARCHAR(50), -- Format: "lat,lng"
    location_point GEOGRAPHY(POINT, 4326), -- Index spatial
    remote BOOLEAN DEFAULT false, -- Télétravail possible
    remote_partiel BOOLEAN DEFAULT false, -- Télétravail partiel
    
    -- Rémunération
    salaire_min DECIMAL(10, 2), -- Salaire minimum
    salaire_max DECIMAL(10, 2), -- Salaire maximum
    devise VARCHAR(10) DEFAULT 'XAF',
    salaire_negociable BOOLEAN DEFAULT false,
    
    -- Exigences
    niveau_etude VARCHAR(100), -- 'Bac', 'Bac+2', 'Bac+3', 'Bac+5', etc.
    experience_min INTEGER, -- Années d'expérience minimum
    competences_requises TEXT[], -- Compétences techniques
    langues_requises JSONB, -- [{"langue": "Français", "niveau": "Courant"}, ...]
    permis_requis TEXT[], -- Permis de conduire, etc.
    
    -- Secteur et domaine
    secteur VARCHAR(100) NOT NULL, -- 'Informatique', 'Commerce', 'Santé', etc.
    domaine VARCHAR(100), -- Sous-domaine
    tags TEXT[], -- Tags pour recherche
    
    -- Dates
    date_publication TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_limite_candidature DATE,
    date_debut_poste DATE,
    
    -- Statut
    statut VARCHAR(50) DEFAULT 'active' CHECK (statut IN ('active', 'pourvue', 'fermee', 'brouillon')),
    nombre_candidatures INTEGER DEFAULT 0,
    nombre_vues INTEGER DEFAULT 0,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false, -- Vérification par admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT check_salaire CHECK (salaire_max IS NULL OR salaire_min IS NULL OR salaire_max >= salaire_min)
);

-- Index pour recherche géographique
CREATE INDEX IF NOT EXISTS idx_offres_location ON offres_emploi USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_offres_statut_active ON offres_emploi(statut, is_active, date_limite_candidature) WHERE statut = 'active' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_offres_secteur ON offres_emploi(secteur, domaine, statut) WHERE statut = 'active';
CREATE INDEX IF NOT EXISTS idx_offres_type_contrat ON offres_emploi(type_contrat, statut) WHERE statut = 'active';
CREATE INDEX IF NOT EXISTS idx_offres_competences ON offres_emploi USING GIN(competences_requises);
CREATE INDEX IF NOT EXISTS idx_offres_tags ON offres_emploi USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_offres_date_limite ON offres_emploi(date_limite_candidature, statut) WHERE date_limite_candidature >= CURRENT_DATE AND statut = 'active';
CREATE INDEX IF NOT EXISTS idx_offres_entreprise ON offres_emploi(entreprise_id, statut);

-- Table : profils_candidats
CREATE TABLE IF NOT EXISTS profils_candidats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations personnelles
    nom_complet VARCHAR(255) NOT NULL,
    date_naissance DATE,
    telephone VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    adresse TEXT,
    ville VARCHAR(100),
    gps VARCHAR(50),
    location_point GEOGRAPHY(POINT, 4326),
    
    -- Profil professionnel
    titre_professionnel VARCHAR(255), -- "Développeur Full Stack", "Comptable", etc.
    niveau_etude VARCHAR(100),
    experience_annees INTEGER DEFAULT 0,
    secteur_principal VARCHAR(100),
    
    -- Compétences
    competences TEXT[], -- Compétences techniques
    langues JSONB, -- [{"langue": "Français", "niveau": "Courant"}, ...]
    permis TEXT[], -- Permis de conduire, etc.
    certifications TEXT[], -- Certifications professionnelles
    
    -- CV et documents
    cv_url TEXT, -- URL du CV
    cv_nom VARCHAR(255),
    photo_url TEXT, -- Photo de profil
    portfolio_url TEXT, -- Portfolio/LinkedIn
    
    -- Préférences
    type_contrat_souhaite TEXT[], -- Types de contrat acceptés
    salaire_souhaite_min DECIMAL(10, 2),
    salaire_souhaite_max DECIMAL(10, 2),
    remote_souhaite BOOLEAN DEFAULT false,
    secteurs_interesses TEXT[], -- Secteurs d'intérêt
    
    -- Disponibilité
    disponible_immediatement BOOLEAN DEFAULT false,
    date_disponibilite DATE,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    is_complete BOOLEAN DEFAULT false, -- Profil complété
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profils_user ON profils_candidats(user_id);
CREATE INDEX IF NOT EXISTS idx_profils_secteur ON profils_candidats(secteur_principal, is_active);
CREATE INDEX IF NOT EXISTS idx_profils_competences ON profils_candidats USING GIN(competences);
CREATE INDEX IF NOT EXISTS idx_profils_location ON profils_candidats USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_profils_disponible ON profils_candidats(disponible_immediatement, is_active) WHERE is_active = true;

-- Table : candidatures
CREATE TABLE IF NOT EXISTS candidatures (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profil_id INTEGER REFERENCES profils_candidats(id) ON DELETE SET NULL,
    
    -- Contenu candidature
    lettre_motivation TEXT,
    cv_url TEXT, -- CV spécifique pour cette candidature (optionnel)
    documents_complementaires JSONB, -- [{"nom": "Diplôme", "url": "..."}, ...]
    
    -- Statut
    statut VARCHAR(50) DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'acceptee', 'refusee', 'annulee')),
    date_candidature TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_modification_statut TIMESTAMP WITH TIME ZONE,
    
    -- Évaluation
    score_matching DECIMAL(5, 2), -- Score de matching (0-100)
    notes_employeur TEXT, -- Notes internes employeur
    evaluation_candidat JSONB, -- Évaluation structurée
    
    -- Métadonnées
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes
    CONSTRAINT unique_candidature UNIQUE (offre_id, candidat_id)
);

CREATE INDEX IF NOT EXISTS idx_candidatures_offre ON candidatures(offre_id, statut);
CREATE INDEX IF NOT EXISTS idx_candidatures_candidat ON candidatures(candidat_id, statut);
CREATE INDEX IF NOT EXISTS idx_candidatures_date ON candidatures(date_candidature DESC);
CREATE INDEX IF NOT EXISTS idx_candidatures_score ON candidatures(score_matching DESC) WHERE score_matching IS NOT NULL;

-- Table : matching_offres_candidats (Cache des matchings)
CREATE TABLE IF NOT EXISTS matching_offres_candidats (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Score de matching
    score_total DECIMAL(5, 2) NOT NULL, -- Score global (0-100)
    score_competences DECIMAL(5, 2), -- Score compétences (0-100)
    score_experience DECIMAL(5, 2), -- Score expérience (0-100)
    score_localisation DECIMAL(5, 2), -- Score localisation (0-100)
    score_salaire DECIMAL(5, 2), -- Score salaire (0-100)
    
    -- Détails matching
    competences_match TEXT[], -- Compétences correspondantes
    competences_manquantes TEXT[], -- Compétences manquantes
    criteres_match JSONB, -- Détails des critères correspondants
    
    -- Métadonnées
    date_calcul TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_notified BOOLEAN DEFAULT false, -- Notification envoyée au candidat
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT unique_matching UNIQUE (offre_id, candidat_id)
);

CREATE INDEX IF NOT EXISTS idx_matching_offre ON matching_offres_candidats(offre_id, score_total DESC);
CREATE INDEX IF NOT EXISTS idx_matching_candidat ON matching_offres_candidats(candidat_id, score_total DESC);
CREATE INDEX IF NOT EXISTS idx_matching_score ON matching_offres_candidats(score_total DESC) WHERE score_total >= 70; -- Seuil minimum
CREATE INDEX IF NOT EXISTS idx_matching_notified ON matching_offres_candidats(is_notified, date_calcul) WHERE is_notified = false;

-- Table : alertes_emploi
CREATE TABLE IF NOT EXISTS alertes_emploi (
    id SERIAL PRIMARY KEY,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Critères de recherche
    titre_poste VARCHAR(255),
    secteur VARCHAR(100),
    type_contrat TEXT[],
    salaire_min DECIMAL(10, 2),
    lieu_travail VARCHAR(255),
    remote BOOLEAN,
    competences TEXT[],
    
    -- Fréquence
    frequence VARCHAR(50) DEFAULT 'quotidienne' CHECK (frequence IN ('instantanee', 'quotidienne', 'hebdomadaire')),
    dernier_envoi TIMESTAMP WITH TIME ZONE,
    
    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertes_candidat ON alertes_emploi(candidat_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alertes_frequence ON alertes_emploi(frequence, dernier_envoi) WHERE is_active = true;

-- Table : statistiques_offres
CREATE TABLE IF NOT EXISTS statistiques_offres (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER NOT NULL REFERENCES offres_emploi(id) ON DELETE CASCADE,
    
    -- Métriques
    nombre_vues INTEGER DEFAULT 0,
    nombre_candidatures INTEGER DEFAULT 0,
    nombre_candidatures_qualifiees INTEGER DEFAULT 0, -- Score > 70
    taux_conversion DECIMAL(5, 2), -- Candidatures / Vues
    
    -- Démographie candidats
    repartition_experience JSONB, -- {"0-2": 10, "3-5": 25, ...}
    repartition_niveau_etude JSONB,
    repartition_localisation JSONB,
    
    -- Métadonnées
    date_calcul TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_stats_offre UNIQUE (offre_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_offre ON statistiques_offres(offre_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_offres_emploi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_offres_emploi_updated_at
    BEFORE UPDATE ON offres_emploi
    FOR EACH ROW
    EXECUTE FUNCTION update_offres_emploi_updated_at();

CREATE TRIGGER trigger_update_profils_candidats_updated_at
    BEFORE UPDATE ON profils_candidats
    FOR EACH ROW
    EXECUTE FUNCTION update_offres_emploi_updated_at();

CREATE TRIGGER trigger_update_candidatures_updated_at
    BEFORE UPDATE ON candidatures
    FOR EACH ROW
    EXECUTE FUNCTION update_offres_emploi_updated_at();

CREATE TRIGGER trigger_update_matching_updated_at
    BEFORE UPDATE ON matching_offres_candidats
    FOR EACH ROW
    EXECUTE FUNCTION update_offres_emploi_updated_at();

CREATE TRIGGER trigger_update_alertes_updated_at
    BEFORE UPDATE ON alertes_emploi
    FOR EACH ROW
    EXECUTE FUNCTION update_offres_emploi_updated_at();

CREATE TRIGGER trigger_update_statistiques_updated_at
    BEFORE UPDATE ON statistiques_offres
    FOR EACH ROW
    EXECUTE FUNCTION update_offres_emploi_updated_at();

-- Trigger pour incrémenter nombre_candidatures lors d'une nouvelle candidature
CREATE OR REPLACE FUNCTION increment_nombre_candidatures()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE offres_emploi
    SET nombre_candidatures = nombre_candidatures + 1
    WHERE id = NEW.offre_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_candidatures
    AFTER INSERT ON candidatures
    FOR EACH ROW
    EXECUTE FUNCTION increment_nombre_candidatures();

-- Fonction pour calculer la distance entre deux points GPS (en km)
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN (
        6371 * acos(
            cos(radians(lat1)) * cos(radians(lat2)) *
            cos(radians(lon2) - radians(lon1)) +
            sin(radians(lat1)) * sin(radians(lat2))
        )
    );
END;
$$ LANGUAGE plpgsql;

