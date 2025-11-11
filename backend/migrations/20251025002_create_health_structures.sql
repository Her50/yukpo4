-- Migration: Créer table health_structures pour l'autocomplete des structures de santé
-- Date: 2025-10-25
-- Description: Table pour stocker les noms de cliniques, pharmacies et laboratoires
--              afin de permettre l'autocomplete partagée entre tous les utilisateurs
-- Note: Compatible avec SQLx offline mode

-- Vérifier et créer la table health_structures
DO $$
BEGIN
    -- Créer la table si elle n'existe pas
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'health_structures') THEN
        CREATE TABLE health_structures (
            id SERIAL PRIMARY KEY,
            structure_type VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            CONSTRAINT unique_structure_name UNIQUE (structure_type, name),
            CONSTRAINT valid_structure_type CHECK (structure_type IN ('hopital_clinique', 'pharmacie', 'laboratoire'))
        );
        
        RAISE NOTICE 'Table health_structures créée avec succès';
    ELSE
        RAISE NOTICE 'Table health_structures existe déjà';
    END IF;
END $$;

-- Index pour recherche rapide par type
CREATE INDEX IF NOT EXISTS idx_health_structures_type ON health_structures(structure_type);

-- Index pour recherche insensible à la casse
CREATE INDEX IF NOT EXISTS idx_health_structures_name_lower ON health_structures(LOWER(name));

-- Index combiné pour filtrage efficace
CREATE INDEX IF NOT EXISTS idx_health_structures_type_name ON health_structures(structure_type, name);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_health_structures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE TRIGGER trigger_health_structures_updated_at
    BEFORE UPDATE ON health_structures
    FOR EACH ROW
    EXECUTE FUNCTION update_health_structures_updated_at();

-- Note: Pas de structures par défaut
-- Les structures seront ajoutées automatiquement au fur et à mesure 
-- que les utilisateurs créent leurs établissements de santé.
-- Cela garantit que seules les structures RÉELLES sont dans la base.

-- Commentaires
COMMENT ON TABLE health_structures IS 'Table pour stocker les noms de structures de santé pour l''autocomplete';
COMMENT ON COLUMN health_structures.structure_type IS 'Type de structure: hopital_clinique, pharmacie, laboratoire';
COMMENT ON COLUMN health_structures.name IS 'Nom de la structure (unique par type)';

