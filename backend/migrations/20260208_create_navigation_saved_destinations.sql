-- ✅ NOUVEAU: Table pour destinations favorites/enregistrées (domicile, bureau, etc.)
-- Créée le 2026-02-08

CREATE TABLE IF NOT EXISTS navigation_saved_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- 'domicile', 'bureau', 'autre', etc.
    custom_label VARCHAR(100), -- Label personnalisé si label = 'autre'
    address TEXT NOT NULL, -- Adresse complète
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    place_id VARCHAR(255), -- Google Place ID si disponible
    is_default BOOLEAN DEFAULT FALSE, -- Destination par défaut pour ce label
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un seul domicile, bureau, etc. par utilisateur (le plus récent est le défaut)
    CONSTRAINT navigation_saved_destinations_user_label_unique UNIQUE(user_id, label)
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_navigation_saved_destinations_user_id ON navigation_saved_destinations(user_id);
CREATE INDEX IF NOT EXISTS idx_navigation_saved_destinations_label ON navigation_saved_destinations(user_id, label);
CREATE INDEX IF NOT EXISTS idx_navigation_saved_destinations_default ON navigation_saved_destinations(user_id, is_default) WHERE is_default = true;

COMMENT ON TABLE navigation_saved_destinations IS 'Destinations favorites/enregistrées des utilisateurs (domicile, bureau, etc.)';
COMMENT ON COLUMN navigation_saved_destinations.label IS 'Type de destination: domicile, bureau, autre';
COMMENT ON COLUMN navigation_saved_destinations.custom_label IS 'Label personnalisé si label = autre';



