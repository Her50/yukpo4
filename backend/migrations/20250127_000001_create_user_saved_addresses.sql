-- Migration: Création de la table user_saved_addresses pour mémoriser les adresses de livraison
-- Date: 2025-01-27
-- Description: Permet aux utilisateurs de sauvegarder leurs adresses de pickup et dropoff pour les réutiliser facilement

CREATE TABLE IF NOT EXISTS user_saved_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identification de l'adresse
    label VARCHAR(100) NOT NULL, -- Ex: "Domicile", "Bureau", "Maison", "Adresse 1"
    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('pickup', 'dropoff', 'both')),
    
    -- Données géographiques
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    
    -- Enrichissement (composants LocationObject)
    location_data JSONB DEFAULT '{}'::jsonb, -- Pour stocker quartier, ville, pays, etc.
    
    -- Informations complémentaires
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    instructions TEXT, -- Instructions de livraison spécifiques
    building_number VARCHAR(50),
    floor VARCHAR(50),
    apartment VARCHAR(50),
    
    -- Métadonnées
    is_default_pickup BOOLEAN DEFAULT FALSE,
    is_default_dropoff BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0, -- Nombre de fois utilisée
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Un seul label par utilisateur (éviter les doublons)
    UNIQUE(user_id, label)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_id ON user_saved_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user_type ON user_saved_addresses(user_id, address_type);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_default ON user_saved_addresses(user_id, is_default_pickup, is_default_dropoff);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_active ON user_saved_addresses(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_last_used ON user_saved_addresses(user_id, last_used_at DESC NULLS LAST);

-- Index spatial pour recherche géographique (nécessite PostGIS)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_location 
        ON user_saved_addresses USING GIST(ST_MakePoint(longitude, latitude));
    END IF;
END $$;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_saved_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_saved_addresses_updated_at
    BEFORE UPDATE ON user_saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_user_saved_addresses_updated_at();

-- Fonction pour incrémenter usage_count et mettre à jour last_used_at
CREATE OR REPLACE FUNCTION increment_user_saved_address_usage(address_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE user_saved_addresses
    SET usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = address_id;
END;
$$ LANGUAGE plpgsql;

-- Contraintes pour s'assurer qu'il n'y a qu'une seule adresse par défaut de chaque type par utilisateur
-- Note: Cette contrainte sera gérée au niveau application, mais on peut aussi créer des triggers si nécessaire

-- Commentaires pour documentation
COMMENT ON TABLE user_saved_addresses IS 'Adresses sauvegardées par les utilisateurs pour pickup et dropoff de livraisons';
COMMENT ON COLUMN user_saved_addresses.label IS 'Nom donné par l''utilisateur à cette adresse (ex: "Domicile", "Bureau")';
COMMENT ON COLUMN user_saved_addresses.address_type IS 'Type d''adresse: pickup (récupération), dropoff (livraison), both (les deux)';
COMMENT ON COLUMN user_saved_addresses.location_data IS 'Données enrichies LocationObject (quartier, ville, pays, etc.) au format JSONB';
COMMENT ON COLUMN user_saved_addresses.usage_count IS 'Nombre de fois que cette adresse a été utilisée dans une livraison';
COMMENT ON COLUMN user_saved_addresses.last_used_at IS 'Date de dernière utilisation de cette adresse';





