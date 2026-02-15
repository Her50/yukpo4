-- ✅ NOUVEAU: Table pour enregistrer les trajets de navigation pour statistiques
-- Créée le 2026-02-08

-- Supprimer la contrainte si elle existe déjà (pour éviter les conflits)
ALTER TABLE IF EXISTS navigation_trips DROP CONSTRAINT IF EXISTS navigation_trips_user_id_fkey;

CREATE TABLE IF NOT EXISTS navigation_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lng DOUBLE PRECISION NOT NULL,
    destination_lat DOUBLE PRECISION NOT NULL,
    destination_lng DOUBLE PRECISION NOT NULL,
    route_id VARCHAR(255) NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    duration_seconds BIGINT NOT NULL,
    waypoints JSONB, -- Points d'arrêt optionnels
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter la contrainte de clé étrangère si elle n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'navigation_trips_user_id_fkey'
    ) THEN
        ALTER TABLE navigation_trips 
        ADD CONSTRAINT navigation_trips_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Index pour optimiser les requêtes de statistiques
CREATE INDEX IF NOT EXISTS idx_navigation_trips_user_id ON navigation_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_navigation_trips_created_at ON navigation_trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_navigation_trips_destination ON navigation_trips(destination_lat, destination_lng);

-- Index composite pour requêtes de statistiques par utilisateur et date
CREATE INDEX IF NOT EXISTS idx_navigation_trips_user_created ON navigation_trips(user_id, created_at DESC);

COMMENT ON TABLE navigation_trips IS 'Enregistre les trajets de navigation des utilisateurs pour générer des statistiques';
COMMENT ON COLUMN navigation_trips.waypoints IS 'Points d''arrêt optionnels le long du trajet (JSON array de {lat, lng})';
