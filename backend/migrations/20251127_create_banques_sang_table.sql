-- Migration: Créer table pour banques de sang (service spécialisé isolé)
-- Date: 2025-11-27
-- Description: Table dédiée pour banques de sang avec gestion des groupes sanguins et stocks
--              Détection intelligente pour recherche spécialisée
-- Note: Compatible avec SQLx offline mode

-- ============================================================================
-- BANQUE DE SANG 🩸
-- ============================================================================

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
    -- Format: {
    --   "O+": {"quantite": 50, "unite": "poches", "derniere_maj": "2025-11-27T10:00:00Z"},
    --   "O-": {"quantite": 30, "unite": "poches", "derniere_maj": "2025-11-27T09:00:00Z"},
    --   "A+": {...}, "A-": {...}, "B+": {...}, "B-": {...}, "AB+": {...}, "AB-": {...}
    -- }
    
    -- Services
    accepte_dons BOOLEAN DEFAULT TRUE,
    accepte_demandes BOOLEAN DEFAULT TRUE,
    urgence_24h BOOLEAN DEFAULT FALSE,
    
    -- Planification
    planning_hebdomadaire JSONB,
    -- Format: {
    --   "lundi": {"ouvert": true, "debut": "08:00", "fin": "17:00", "permanent": false},
    --   ...
    -- }
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
    ST_MakePoint(
        SPLIT_PART(gps, ',', 2)::DOUBLE PRECISION,
        SPLIT_PART(gps, ',', 1)::DOUBLE PRECISION
    )::geography
) WHERE gps IS NOT NULL AND gps != '';

-- Trigger pour updated_at
CREATE TRIGGER update_banques_sang_updated_at 
    BEFORE UPDATE ON banques_sang 
    FOR EACH ROW 
    EXECUTE FUNCTION update_timestamp();

-- Commentaires
COMMENT ON TABLE banques_sang IS 'Banques de sang avec gestion des groupes sanguins, stocks et disponibilité en temps réel';
COMMENT ON COLUMN banques_sang.hopital_id IS 'Lien optionnel avec un établissement de santé (peut être indépendant)';
COMMENT ON COLUMN banques_sang.stocks_groupes_sanguins IS 'Stocks par groupe sanguin avec quantités et dates de mise à jour (JSONB)';
COMMENT ON COLUMN banques_sang.is_available_now IS 'Calculé automatiquement avec planning_hebdomadaire et NOW()';
COMMENT ON COLUMN banques_sang.horaires_dons IS 'Horaires spécifiques pour les dons de sang (peut différer des horaires généraux)';

-- ============================================================================
-- SUPPRESSION banque_sang de hopitaux_cliniques
-- ============================================================================

-- Supprimer la colonne banque_sang de hopitaux_cliniques
-- (Si un hôpital a une banque de sang, il doit créer un service spécialisé dédié)
ALTER TABLE hopitaux_cliniques DROP COLUMN IF EXISTS banque_sang;

