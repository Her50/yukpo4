-- Migration: Créer tables pour bourse du livre scolaire et troc intelligent
-- Date: 2025-01-28
-- Description: Tables dédiées pour livres scolaires, trocs directs et chaînes de troc
--              avec matching intelligent, proximité géographique, et médias
-- Note: Compatible avec SQLx offline mode (pas de SELECT retournant des résultats)

-- ============================================================================
-- TABLE 1: LIVRES SCOLAIRES
-- ============================================================================

CREATE TABLE IF NOT EXISTS livres_scolaires (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations livre
    titre TEXT NOT NULL,
    auteur TEXT,
    editeur TEXT,
    isbn TEXT,
    classe_actuelle TEXT NOT NULL, -- Classe actuelle de l'élève (ex: "6ème", "5ème")
    classe_souhaitee TEXT NOT NULL, -- Classe souhaitée (ex: "5ème", "4ème")
    matiere TEXT NOT NULL, -- "Mathématiques", "Français", etc.
    niveau TEXT, -- "Primaire", "Collège", "Lycée"
    
    -- État et médias
    etat_livre TEXT NOT NULL, -- "Neuf", "Très bon", "Bon", "Acceptable"
    description_etat TEXT,
    images_urls TEXT[], -- URLs des images du livre
    video_url TEXT, -- URL vidéo d'appréciation de l'état
    
    -- Géolocalisation
    gps TEXT, -- Format: "lat,lng"
    ville TEXT,
    quartier TEXT,
    
    -- Disponibilité
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE 2: TROC LIVRES SCOLAIRES (Troc direct ou partie de chaîne)
-- ============================================================================

CREATE TABLE IF NOT EXISTS troc_livres_scolaires (
    id SERIAL PRIMARY KEY,
    
    -- Participants
    initiateur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    participant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Livres échangés
    livre_offert_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    livre_souhaite_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    
    -- Type de troc
    type_troc TEXT NOT NULL, -- "direct" (2 personnes) ou "chaine" (3+ personnes)
    chaine_troc_id INTEGER, -- ID de la chaîne si type_troc = "chaine"
    
    -- Statut
    statut TEXT NOT NULL DEFAULT 'en_attente', -- "en_attente", "accepte", "refuse", "annule", "complete"
    
    -- Validation
    validation_initiateur BOOLEAN DEFAULT false,
    validation_participant BOOLEAN DEFAULT false,
    validation_video BOOLEAN DEFAULT false, -- Validation via vidéo live
    
    -- Proximité
    distance_km FLOAT,
    
    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_echange TIMESTAMPTZ, -- Date prévue pour l'échange physique
    date_complete TIMESTAMPTZ -- Date de finalisation
);

-- ============================================================================
-- TABLE 3: CHAINES TROC LIVRES (Troc multi-personnes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS chaines_troc_livres (
    id SERIAL PRIMARY KEY,
    
    -- Participants (ordre de la chaîne)
    participants JSONB NOT NULL, -- [{user_id, livre_offert_id, livre_souhaite_id, ordre}]
    
    -- Statut
    statut TEXT NOT NULL DEFAULT 'en_formation', -- "en_formation", "validee", "en_cours", "complete"
    
    -- Score de proximité global
    score_proximite FLOAT,
    distance_totale_km FLOAT,
    
    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_validation TIMESTAMPTZ,
    date_complete TIMESTAMPTZ
);

-- ============================================================================
-- INDEX DE SCALABILITÉ - LIVRES SCOLAIRES
-- ============================================================================

-- Index pour recherche par classe actuelle
CREATE INDEX IF NOT EXISTS idx_livres_classe_actuelle ON livres_scolaires(classe_actuelle, matiere)
    WHERE is_active = true AND is_available = true;

-- Index pour recherche par classe souhaitée
CREATE INDEX IF NOT EXISTS idx_livres_classe_souhaitee ON livres_scolaires(classe_souhaitee, matiere)
    WHERE is_active = true AND is_available = true;

-- Index pour matching bidirectionnel (classe_actuelle ↔ classe_souhaitee)
CREATE INDEX IF NOT EXISTS idx_livres_matching ON livres_scolaires(classe_actuelle, classe_souhaitee, matiere)
    WHERE is_active = true AND is_available = true;

-- Index GPS pour proximité géographique (avec PostGIS si disponible)
-- Note: Si PostGIS n'est pas disponible, utiliser index B-tree sur gps
CREATE INDEX IF NOT EXISTS idx_livres_gps_btree ON livres_scolaires(gps)
    WHERE gps IS NOT NULL AND is_active = true;

-- Tentative d'index spatial GIST si PostGIS est disponible (ignore erreur si non disponible)
DO $$
BEGIN
    -- Créer index spatial GIST pour recherches de proximité optimisées
    CREATE INDEX IF NOT EXISTS idx_livres_gps_gist ON livres_scolaires USING GIST(
        ST_MakePoint(
            CAST(SPLIT_PART(gps, ',', 1) AS FLOAT),
            CAST(SPLIT_PART(gps, ',', 2) AS FLOAT)
        )
    ) WHERE gps IS NOT NULL AND is_active = true;
EXCEPTION
    WHEN undefined_function THEN
        -- PostGIS non disponible, ignorer cette partie
        RAISE NOTICE 'PostGIS non disponible, index spatial ignoré';
    WHEN OTHERS THEN
        -- Autre erreur, ignorer
        RAISE NOTICE 'Erreur création index spatial: %', SQLERRM;
END $$;

-- Index pour recherche par ville/quartier
CREATE INDEX IF NOT EXISTS idx_livres_ville_quartier ON livres_scolaires(ville, quartier)
    WHERE is_active = true;

-- Index pour recherche par matière et niveau
CREATE INDEX IF NOT EXISTS idx_livres_matiere_niveau ON livres_scolaires(matiere, niveau)
    WHERE is_active = true AND is_available = true;

-- Index pour recherche par état
CREATE INDEX IF NOT EXISTS idx_livres_etat ON livres_scolaires(etat_livre)
    WHERE is_active = true AND is_available = true;

-- Index pour recherche par utilisateur (mes livres)
CREATE INDEX IF NOT EXISTS idx_livres_user_id ON livres_scolaires(user_id, created_at DESC)
    WHERE is_active = true;

-- Index GIN pour recherche texte (titre, auteur)
-- Note: Créer index GIN seulement si pg_trgm est disponible
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_livres_titre_trgm ON livres_scolaires USING GIN(titre gin_trgm_ops)
        WHERE is_active = true AND is_available = true;
    CREATE INDEX IF NOT EXISTS idx_livres_auteur_trgm ON livres_scolaires USING GIN(auteur gin_trgm_ops)
        WHERE auteur IS NOT NULL AND is_active = true AND is_available = true;
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE 'pg_trgm non disponible, index texte ignoré';
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur création index texte: %', SQLERRM;
END $$;

-- ============================================================================
-- INDEX DE SCALABILITÉ - TROC LIVRES SCOLAIRES
-- ============================================================================

-- Index pour recherche par statut (tri par date création)
CREATE INDEX IF NOT EXISTS idx_troc_statut ON troc_livres_scolaires(statut, created_at DESC);

-- Index pour recherche par initiateur
CREATE INDEX IF NOT EXISTS idx_troc_initiateur ON troc_livres_scolaires(initiateur_id, statut);

-- Index pour recherche par participant
CREATE INDEX IF NOT EXISTS idx_troc_participant ON troc_livres_scolaires(participant_id, statut);

-- Index pour recherche par chaîne
CREATE INDEX IF NOT EXISTS idx_troc_chaine ON troc_livres_scolaires(chaine_troc_id)
    WHERE chaine_troc_id IS NOT NULL;

-- Index pour recherche par livre offert
CREATE INDEX IF NOT EXISTS idx_troc_livre_offert ON troc_livres_scolaires(livre_offert_id);

-- Index pour recherche par livre souhaité
CREATE INDEX IF NOT EXISTS idx_troc_livre_souhaite ON troc_livres_scolaires(livre_souhaite_id);

-- Index pour recherche par date d'échange
CREATE INDEX IF NOT EXISTS idx_troc_date_echange ON troc_livres_scolaires(date_echange)
    WHERE date_echange IS NOT NULL;

-- ============================================================================
-- INDEX DE SCALABILITÉ - CHAINES TROC LIVRES
-- ============================================================================

-- Index pour recherche par statut
CREATE INDEX IF NOT EXISTS idx_chaines_statut ON chaines_troc_livres(statut, created_at DESC);

-- Index pour recherche par score de proximité (tri par meilleur score)
CREATE INDEX IF NOT EXISTS idx_chaines_score_proximite ON chaines_troc_livres(score_proximite DESC)
    WHERE score_proximite IS NOT NULL;

-- Index GIN pour recherche dans participants JSONB
CREATE INDEX IF NOT EXISTS idx_chaines_participants_gin ON chaines_troc_livres USING GIN(participants);

-- ============================================================================
-- TRIGGERS POUR UPDATED_AT
-- ============================================================================

-- Fonction générique pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour livres_scolaires
CREATE TRIGGER trigger_update_livres_scolaires_updated_at
    BEFORE UPDATE ON livres_scolaires
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers pour troc_livres_scolaires
CREATE TRIGGER trigger_update_troc_livres_scolaires_updated_at
    BEFORE UPDATE ON troc_livres_scolaires
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers pour chaines_troc_livres
CREATE TRIGGER trigger_update_chaines_troc_livres_updated_at
    BEFORE UPDATE ON chaines_troc_livres
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE livres_scolaires IS 'Livres scolaires disponibles pour troc avec gestion d''état et médias';
COMMENT ON TABLE troc_livres_scolaires IS 'Troc direct (2 personnes) ou partie de chaîne de troc';
COMMENT ON TABLE chaines_troc_livres IS 'Chaînes de troc multi-personnes avec score de proximité';

COMMENT ON COLUMN livres_scolaires.classe_actuelle IS 'Classe actuelle de l''élève (ex: "6ème", "5ème")';
COMMENT ON COLUMN livres_scolaires.classe_souhaitee IS 'Classe souhaitée pour le troc (ex: "5ème", "4ème")';
COMMENT ON COLUMN livres_scolaires.images_urls IS 'Tableau d''URLs des images du livre';
COMMENT ON COLUMN livres_scolaires.video_url IS 'URL de la vidéo d''appréciation de l''état du livre';

COMMENT ON COLUMN troc_livres_scolaires.type_troc IS 'Type de troc: "direct" (2 personnes) ou "chaine" (3+ personnes)';
COMMENT ON COLUMN troc_livres_scolaires.validation_video IS 'Validation via vidéo live (WebRTC/LiveKit)';

COMMENT ON COLUMN chaines_troc_livres.participants IS 'JSONB avec ordre de la chaîne: [{user_id, livre_offert_id, livre_souhaite_id, ordre}]';
COMMENT ON COLUMN chaines_troc_livres.score_proximite IS 'Score global de proximité géographique de la chaîne';
COMMENT ON COLUMN chaines_troc_livres.distance_totale_km IS 'Distance totale en km de tous les segments de la chaîne';

