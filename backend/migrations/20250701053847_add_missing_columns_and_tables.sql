-- Migration pour ajouter les colonnes et tables manquantes
-- Date: 2025-01-07

-- Ajouter la colonne 'don' à la table echanges si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'echanges' AND column_name = 'don') THEN
        ALTER TABLE echanges ADD COLUMN don BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Créer la table programmes_scolaires si elle n'existe pas
CREATE TABLE IF NOT EXISTS programmes_scolaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etablissement VARCHAR(255) NOT NULL,
    classe VARCHAR(50) NOT NULL,
    annee INTEGER NOT NULL,
    programme JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(etablissement, classe, annee)
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_etablissement_classe ON programmes_scolaires(etablissement, classe);
CREATE INDEX IF NOT EXISTS idx_echanges_don ON echanges(don);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_programmes_scolaires_updated_at 
    BEFORE UPDATE ON programmes_scolaires 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 