-- Migration : création de la table programmes_scolaires pour la gestion des programmes officiels
CREATE TABLE IF NOT EXISTS programmes_scolaires (
    id SERIAL PRIMARY KEY,
    etablissement TEXT NOT NULL,
    classe TEXT NOT NULL,
    annee TEXT,
    programme JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (etablissement, classe, annee)
);
-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_etablissement ON programmes_scolaires(etablissement);
CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_classe ON programmes_scolaires(classe);
