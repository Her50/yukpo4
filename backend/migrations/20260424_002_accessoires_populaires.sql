-- Migration : table des accessoires populaires par classe (historisation)
-- Date : 2026-04-24
--
-- Sert de suggestion par défaut lors de la sélection parent et accumule
-- l'historique des extractions IA pour chaque classe.

BEGIN;

CREATE TABLE IF NOT EXISTS accessoires_populaires_par_classe (
    id SERIAL PRIMARY KEY,
    pays TEXT NOT NULL DEFAULT 'CM',
    systeme_id TEXT,                      -- ex: "CM-fr", "CI-fr"
    niveau TEXT NOT NULL,
    classe TEXT NOT NULL,
    nom TEXT NOT NULL,                    -- "Cahier 200 pages Seyès"
    nom_normalise TEXT NOT NULL,          -- pour dédup
    quantite_mediane INTEGER,
    gamme_defaut TEXT,                    -- "entree"|"standard"|"premium"
    prix_min DECIMAL(12,2),
    prix_median DECIMAL(12,2),
    prix_max DECIMAL(12,2),
    devise TEXT DEFAULT 'XAF',
    occurrences INTEGER NOT NULL DEFAULT 1,
    derniere_vue TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_acc_pop_pays_niveau_classe_nom
    ON accessoires_populaires_par_classe(pays, niveau, classe, nom_normalise);

CREATE INDEX IF NOT EXISTS idx_acc_pop_pays_classe
    ON accessoires_populaires_par_classe(pays, classe, occurrences DESC);

CREATE INDEX IF NOT EXISTS idx_acc_pop_systeme
    ON accessoires_populaires_par_classe(systeme_id, classe, occurrences DESC)
    WHERE systeme_id IS NOT NULL;

COMMIT;
