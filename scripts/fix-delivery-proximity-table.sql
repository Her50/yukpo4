-- Script pour créer la table delivery_proximity_suggestions manquante
-- Erreur: relation "delivery_proximity_suggestions" does not exist

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS delivery_proximity_suggestions (
    id SERIAL PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    suggested_status TEXT NOT NULL,
    location_type TEXT NOT NULL, -- "pickup" ou "dropoff"
    distance_meters FLOAT,
    auto_confirm_after_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'auto_confirmed', 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    courier_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery 
    ON delivery_proximity_suggestions(delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status 
    ON delivery_proximity_suggestions(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_created 
    ON delivery_proximity_suggestions(created_at);

-- Index pour le monitoring (optimisation)
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_created 
    ON delivery_proximity_suggestions (status, created_at)
    WHERE status = 'pending' AND auto_confirm_after_seconds IS NOT NULL;

-- Vérifier que la table a été créée
SELECT 
    'Table delivery_proximity_suggestions créée avec succès' as message,
    COUNT(*) as nombre_indexes
FROM pg_indexes 
WHERE tablename = 'delivery_proximity_suggestions';


