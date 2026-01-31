-- Migration: Tables avancées pour Orientation Scolaire avec IA
-- Date: 2025-01-27
-- Description: Tables pour profils étudiants, recommandations IA, comparaisons programmes et analytics
-- Compatible SQLx offline mode

-- Extension PostGIS pour géolocalisation (déjà créée normalement)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. TABLE : Profils étudiants (pour recommandations IA personnalisées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS student_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations personnelles
    nom_complet VARCHAR(255) NOT NULL,
    date_naissance DATE,
    ville VARCHAR(100),
    region VARCHAR(100),
    gps VARCHAR(50), -- Format: "lat,lng"
    location_point GEOGRAPHY(POINT, 4326),
    
    -- Niveau actuel
    niveau_actuel VARCHAR(50), -- "6ème", "Terminale", "Bac+2", etc.
    classe_actuelle VARCHAR(50),
    etablissement_actuel VARCHAR(255),
    
    -- Notes et performances
    notes_moyennes JSONB, -- {"Mathématiques": 15.5, "Français": 14.0, ...}
    moyenne_generale DECIMAL(4, 2),
    classement INTEGER, -- Classement dans la classe
    effectif_classe INTEGER,
    
    -- Intérêts et objectifs
    matieres_preferees TEXT[], -- Matières préférées
    matieres_faibles TEXT[], -- Matières à améliorer
    objectifs_carriere TEXT[], -- Objectifs de carrière
    secteurs_interets TEXT[], -- Secteurs d'intérêt
    
    -- Contraintes et préférences
    budget_max DECIMAL(10, 2), -- Budget maximum pour études
    preference_localisation TEXT[], -- Villes/régions préférées
    preference_type_etablissement TEXT[], -- Types d'établissements préférés
    
    -- Métadonnées
    is_complete BOOLEAN DEFAULT false, -- Profil complété
    last_analysis_date TIMESTAMPTZ, -- Dernière analyse IA
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_niveau ON student_profiles(niveau_actuel, classe_actuelle);
CREATE INDEX IF NOT EXISTS idx_student_profiles_location ON student_profiles USING GIST(location_point);
CREATE INDEX IF NOT EXISTS idx_student_profiles_complete ON student_profiles(is_complete) WHERE is_complete = true;

-- ============================================================================
-- 2. TABLE : Recommandations IA de programmes/établissements
-- ============================================================================
CREATE TABLE IF NOT EXISTS program_recommendations (
    id SERIAL PRIMARY KEY,
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    etablissement_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    
    -- Type de recommandation
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('filiere', 'etablissement', 'programme', 'specialite')),
    filiere VARCHAR(100),
    specialite VARCHAR(100),
    
    -- Scores IA
    score_total DECIMAL(5, 2) NOT NULL, -- Score global (0-100)
    score_academique DECIMAL(5, 2), -- Score basé sur notes (0-100)
    score_interets DECIMAL(5, 2), -- Score basé sur intérêts (0-100)
    score_budget DECIMAL(5, 2), -- Score basé sur budget (0-100)
    score_localisation DECIMAL(5, 2), -- Score basé sur localisation (0-100)
    
    -- Détails
    reasoning TEXT, -- Explication de la recommandation
    points_forts TEXT[], -- Points forts de cette recommandation
    points_faibles TEXT[], -- Points faibles
    alternatives INTEGER[], -- IDs d'établissements alternatifs
    
    -- Métadonnées
    model_used VARCHAR(100), -- Modèle IA utilisé
    tokens_consumed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- Expiration du cache
);

CREATE INDEX IF NOT EXISTS idx_program_recommendations_profile ON program_recommendations(student_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_recommendations_etablissement ON program_recommendations(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_program_recommendations_score ON program_recommendations(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_program_recommendations_type ON program_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_program_recommendations_expires ON program_recommendations(expires_at);

-- ============================================================================
-- 3. TABLE : Comparaisons de programmes (IA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS program_comparisons (
    id SERIAL PRIMARY KEY,
    student_profile_id INTEGER NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
    
    -- Programmes comparés
    etablissement_1_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    etablissement_2_id INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    filiere_1 VARCHAR(100),
    filiere_2 VARCHAR(100),
    specialite_1 VARCHAR(100),
    specialite_2 VARCHAR(100),
    
    -- Comparaison IA
    comparison_criteria JSONB NOT NULL, -- Critères de comparaison utilisés
    comparison_results JSONB NOT NULL, -- Résultats de comparaison détaillés
    winner_etablissement_id INTEGER, -- ID de l'établissement gagnant (si applicable)
    winner_reasoning TEXT, -- Raison du choix
    
    -- Scores comparatifs
    score_etablissement_1 DECIMAL(5, 2) NOT NULL,
    score_etablissement_2 DECIMAL(5, 2) NOT NULL,
    
    -- Métadonnées
    model_used VARCHAR(100),
    tokens_consumed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_program_comparisons_profile ON program_comparisons(student_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_program_comparisons_etablissement_1 ON program_comparisons(etablissement_1_id);
CREATE INDEX IF NOT EXISTS idx_program_comparisons_etablissement_2 ON program_comparisons(etablissement_2_id);
CREATE INDEX IF NOT EXISTS idx_program_comparisons_expires ON program_comparisons(expires_at);

-- ============================================================================
-- 4. TABLE : Analytics Orientation Scolaire
-- ============================================================================
CREATE TABLE IF NOT EXISTS orientation_analytics (
    id SERIAL PRIMARY KEY,
    etablissement_id INTEGER REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- Prestataire
    
    -- Métriques
    nombre_vues INTEGER DEFAULT 0,
    nombre_contacts INTEGER DEFAULT 0,
    nombre_recommendations INTEGER DEFAULT 0,
    nombre_comparaisons INTEGER DEFAULT 0,
    nombre_inscriptions INTEGER DEFAULT 0, -- Inscriptions suite aux recommandations
    
    -- Démographie
    repartition_niveaux JSONB, -- {"6ème": 10, "Terminale": 25, ...}
    repartition_filieres JSONB, -- {"Scientifique": 30, "Littéraire": 20, ...}
    repartition_villes JSONB, -- {"Douala": 15, "Yaoundé": 20, ...}
    
    -- Scores
    score_satisfaction DECIMAL(5, 2), -- Score moyen de satisfaction (1-5)
    score_popularite DECIMAL(5, 2) DEFAULT 0, -- Score de popularité (0-100)
    
    -- Période
    periode_debut DATE NOT NULL,
    periode_fin DATE NOT NULL,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_orientation_analytics UNIQUE (etablissement_id, user_id, periode_debut, periode_fin)
);

CREATE INDEX IF NOT EXISTS idx_orientation_analytics_etablissement ON orientation_analytics(etablissement_id, periode_debut DESC);
CREATE INDEX IF NOT EXISTS idx_orientation_analytics_user ON orientation_analytics(user_id, periode_debut DESC);
CREATE INDEX IF NOT EXISTS idx_orientation_analytics_periode ON orientation_analytics(periode_debut, periode_fin);

-- ============================================================================
-- TRIGGERS POUR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_student_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_profiles_updated_at ON student_profiles;
CREATE TRIGGER trigger_update_student_profiles_updated_at
    BEFORE UPDATE ON student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_student_profiles_updated_at();

CREATE OR REPLACE FUNCTION update_orientation_analytics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_orientation_analytics_updated_at ON orientation_analytics;
CREATE TRIGGER trigger_update_orientation_analytics_updated_at
    BEFORE UPDATE ON orientation_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_orientation_analytics_updated_at();

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour nettoyer les recommandations expirées
CREATE OR REPLACE FUNCTION cleanup_expired_orientation_recommendations()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM program_recommendations
    WHERE expires_at < NOW();
    
    DELETE FROM program_comparisons
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE student_profiles IS 'Profils étudiants pour recommandations IA personnalisées';
COMMENT ON TABLE program_recommendations IS 'Recommandations IA de programmes/établissements avec scores détaillés';
COMMENT ON TABLE program_comparisons IS 'Comparaisons IA de programmes avec résultats détaillés';
COMMENT ON TABLE orientation_analytics IS 'Analytics pour établissements : vues, contacts, recommandations, inscriptions';

COMMENT ON COLUMN student_profiles.notes_moyennes IS 'Notes moyennes par matière en JSONB';
COMMENT ON COLUMN program_recommendations.score_total IS 'Score global de recommandation IA (0-100)';
COMMENT ON COLUMN program_comparisons.comparison_results IS 'Résultats de comparaison détaillés en JSONB';

