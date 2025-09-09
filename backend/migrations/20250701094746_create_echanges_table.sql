-- Add migration script here

-- Création de la table echanges pour la gestion des demandes d'échange
CREATE TABLE IF NOT EXISTS echanges (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    offre JSONB NOT NULL,
    besoin JSONB NOT NULL,
    statut VARCHAR(32) NOT NULL DEFAULT 'en_attente',
    matched_with INT REFERENCES echanges(id),
    quantite_offerte DOUBLE PRECISION,
    quantite_requise DOUBLE PRECISION,
    lot_id INT,
    disponibilite JSONB,
    contraintes JSONB,
    reputation DOUBLE PRECISION,
    gps_fixe_lat DOUBLE PRECISION,
    gps_fixe_lon DOUBLE PRECISION,
    don BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_echanges_statut ON echanges(statut);
CREATE INDEX IF NOT EXISTS idx_echanges_don ON echanges(don);
