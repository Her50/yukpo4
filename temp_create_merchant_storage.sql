-- Créer la table merchant_storage_locations manquante
CREATE TABLE IF NOT EXISTS merchant_storage_locations (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER,
    name VARCHAR(255),
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);



