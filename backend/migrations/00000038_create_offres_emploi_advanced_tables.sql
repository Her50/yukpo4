-- Migration: Tables avancées pour Offres d'Emploi avec IA améliorée
-- Date: 2025-01-27
-- Description: Tables pour matching IA amélioré, analyse CV IA, prédictions salaires et analytics avancés
-- Compatible SQLx offline mode

-- Extension PostGIS pour géolocalisation (déjà créée normalement)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. TABLE : Matching IA amélioré (cache des matchings avec IA)
-- ============================================================================
-- Note: La table matching_offres_candidats existe déjà, on ajoute des champs IA
DO $$
BEGIN
    -- Ajouter colonnes IA si elles n'existent pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'matching_offres_candidats' 
        AND column_name = 'ai_score'
    ) THEN
        ALTER TABLE matching_offres_candidats
        ADD COLUMN ai_score DECIMAL(5, 2), -- Score IA (0-100)
        ADD COLUMN ai_reasoning TEXT, -- Explication IA du matching
        ADD COLUMN ai_model_used VARCHAR(100), -- Modèle IA utilisé
        ADD COLUMN ai_tokens_consumed INTEGER,
        ADD COLUMN ai_competences_analysis JSONB, -- Analyse détaillée des compétences
        ADD COLUMN ai_experience_analysis JSONB, -- Analyse détaillée de l'expérience
        ADD COLUMN ai_cultural_fit DECIMAL(5, 2), -- Score de fit culturel (0-100)
        ADD COLUMN ai_improvement_suggestions TEXT[]; -- Suggestions d'amélioration
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matching_ai_score ON matching_offres_candidats(ai_score DESC) WHERE ai_score IS NOT NULL;

-- ============================================================================
-- 2. TABLE : Analyse CV IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS cv_ai_analyses (
    id SERIAL PRIMARY KEY,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profil_id INTEGER REFERENCES profils_candidats(id) ON DELETE CASCADE,
    cv_url TEXT NOT NULL, -- URL du CV analysé
    
    -- Analyse IA
    competences_extracted TEXT[], -- Compétences extraites du CV
    experience_years_extracted INTEGER, -- Années d'expérience extraites
    niveau_etude_extracted VARCHAR(100), -- Niveau d'étude extrait
    langues_extracted JSONB, -- Langues extraites [{"langue": "Français", "niveau": "Courant"}]
    certifications_extracted TEXT[], -- Certifications extraites
    formations_extracted JSONB, -- Formations extraites
    
    -- Scores IA
    score_completude DECIMAL(5, 2), -- Score de complétude du CV (0-100)
    score_qualite DECIMAL(5, 2), -- Score de qualité du CV (0-100)
    score_pertinence DECIMAL(5, 2), -- Score de pertinence pour le marché (0-100)
    
    -- Suggestions
    suggestions_amelioration TEXT[], -- Suggestions d'amélioration du CV
    competences_manquantes TEXT[], -- Compétences manquantes pour le marché
    formations_suggestees TEXT[], -- Formations suggérées
    
    -- Métadonnées
    model_used VARCHAR(100), -- Modèle IA utilisé
    tokens_consumed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- Expiration du cache
);

CREATE INDEX IF NOT EXISTS idx_cv_ai_analyses_candidat ON cv_ai_analyses(candidat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_ai_analyses_profil ON cv_ai_analyses(profil_id) WHERE profil_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cv_ai_analyses_score ON cv_ai_analyses(score_qualite DESC);
CREATE INDEX IF NOT EXISTS idx_cv_ai_analyses_expires ON cv_ai_analyses(expires_at);

-- ============================================================================
-- 3. TABLE : Prédictions salaires IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_predictions (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER REFERENCES offres_emploi(id) ON DELETE CASCADE,
    candidat_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contexte
    titre_poste VARCHAR(255) NOT NULL,
    secteur VARCHAR(100) NOT NULL,
    ville VARCHAR(100),
    experience_annees INTEGER,
    niveau_etude VARCHAR(100),
    competences TEXT[],
    
    -- Prédictions IA
    salaire_predicted_min DECIMAL(10, 2) NOT NULL, -- Salaire prédit minimum
    salaire_predicted_max DECIMAL(10, 2) NOT NULL, -- Salaire prédit maximum
    salaire_predicted_median DECIMAL(10, 2) NOT NULL, -- Salaire prédit médian
    devise VARCHAR(10) DEFAULT 'XAF',
    
    -- Facteurs
    facteurs_influence JSONB, -- Facteurs qui influencent le salaire
    comparaison_marche JSONB, -- Comparaison avec le marché
    
    -- Métadonnées
    model_used VARCHAR(100),
    tokens_consumed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- Expiration du cache
);

CREATE INDEX IF NOT EXISTS idx_salary_predictions_offre ON salary_predictions(offre_id);
CREATE INDEX IF NOT EXISTS idx_salary_predictions_candidat ON salary_predictions(candidat_id);
CREATE INDEX IF NOT EXISTS idx_salary_predictions_titre_secteur ON salary_predictions(titre_poste, secteur, ville);
CREATE INDEX IF NOT EXISTS idx_salary_predictions_expires ON salary_predictions(expires_at);

-- ============================================================================
-- 4. TABLE : Suggestions formations IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS formation_suggestions (
    id SERIAL PRIMARY KEY,
    candidat_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offre_id INTEGER REFERENCES offres_emploi(id) ON DELETE CASCADE,
    
    -- Contexte
    competences_manquantes TEXT[], -- Compétences manquantes identifiées
    objectif_carriere TEXT, -- Objectif de carrière
    
    -- Suggestions IA
    formations_suggestees JSONB NOT NULL, -- [{"nom": "Formation X", "type": "en_ligne", "duree": "3 mois", "cout": 50000, "url": "...", "score_pertinence": 85}]
    certifications_suggestees JSONB, -- Certifications suggérées
    
    -- Scores
    score_pertinence DECIMAL(5, 2), -- Score de pertinence global (0-100)
    
    -- Métadonnées
    model_used VARCHAR(100),
    tokens_consumed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_formation_suggestions_candidat ON formation_suggestions(candidat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_formation_suggestions_offre ON formation_suggestions(offre_id) WHERE offre_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_formation_suggestions_expires ON formation_suggestions(expires_at);

-- ============================================================================
-- 5. TABLE : Analytics Emploi avancés
-- ============================================================================
CREATE TABLE IF NOT EXISTS emploi_analytics_advanced (
    id SERIAL PRIMARY KEY,
    offre_id INTEGER REFERENCES offres_emploi(id) ON DELETE CASCADE,
    entreprise_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Métriques avancées
    nombre_vues INTEGER DEFAULT 0,
    nombre_candidatures INTEGER DEFAULT 0,
    nombre_candidatures_qualifiees INTEGER DEFAULT 0, -- Score >= 70
    nombre_candidatures_ia_qualifiees INTEGER DEFAULT 0, -- Score IA >= 70
    taux_conversion DECIMAL(5, 2), -- Candidatures / Vues
    taux_conversion_ia DECIMAL(5, 2), -- Candidatures IA qualifiées / Vues
    
    -- Démographie candidats
    repartition_experience JSONB, -- {"0-2": 10, "3-5": 25, ...}
    repartition_niveau_etude JSONB,
    repartition_localisation JSONB,
    repartition_competences JSONB, -- Compétences les plus fréquentes
    
    -- Scores IA
    score_moyen_matching DECIMAL(5, 2), -- Score moyen de matching
    score_moyen_matching_ia DECIMAL(5, 2), -- Score moyen de matching IA
    
    -- Période
    periode_debut DATE NOT NULL,
    periode_fin DATE NOT NULL,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_emploi_analytics_advanced UNIQUE (offre_id, entreprise_id, periode_debut, periode_fin)
);

CREATE INDEX IF NOT EXISTS idx_emploi_analytics_advanced_offre ON emploi_analytics_advanced(offre_id, periode_debut DESC);
CREATE INDEX IF NOT EXISTS idx_emploi_analytics_advanced_entreprise ON emploi_analytics_advanced(entreprise_id, periode_debut DESC);
CREATE INDEX IF NOT EXISTS idx_emploi_analytics_advanced_periode ON emploi_analytics_advanced(periode_debut, periode_fin);

-- ============================================================================
-- TRIGGERS POUR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cv_ai_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cv_ai_analyses_updated_at ON cv_ai_analyses;
CREATE TRIGGER trigger_update_cv_ai_analyses_updated_at
    BEFORE UPDATE ON cv_ai_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_cv_ai_analyses_updated_at();

CREATE OR REPLACE FUNCTION update_emploi_analytics_advanced_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_emploi_analytics_advanced_updated_at ON emploi_analytics_advanced;
CREATE TRIGGER trigger_update_emploi_analytics_advanced_updated_at
    BEFORE UPDATE ON emploi_analytics_advanced
    FOR EACH ROW
    EXECUTE FUNCTION update_emploi_analytics_advanced_updated_at();

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour nettoyer les analyses expirées
CREATE OR REPLACE FUNCTION cleanup_expired_emploi_ai_data()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM cv_ai_analyses
    WHERE expires_at < NOW();
    
    DELETE FROM salary_predictions
    WHERE expires_at < NOW();
    
    DELETE FROM formation_suggestions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE cv_ai_analyses IS 'Analyses IA de CV avec extraction compétences, scores et suggestions';
COMMENT ON TABLE salary_predictions IS 'Prédictions salaires IA basées sur marché, expérience, compétences';
COMMENT ON TABLE formation_suggestions IS 'Suggestions formations IA basées sur compétences manquantes';
COMMENT ON TABLE emploi_analytics_advanced IS 'Analytics avancés pour offres d''emploi avec métriques IA';

COMMENT ON COLUMN matching_offres_candidats.ai_score IS 'Score IA de matching (0-100)';
COMMENT ON COLUMN cv_ai_analyses.score_qualite IS 'Score de qualité du CV IA (0-100)';
COMMENT ON COLUMN salary_predictions.salaire_predicted_median IS 'Salaire prédit médian par IA';

