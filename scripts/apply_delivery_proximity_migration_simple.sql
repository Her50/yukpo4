-- Script SQL simple pour appliquer la migration delivery_proximity_suggestions
-- À exécuter directement sur Cloud SQL via la console ou psql

-- ✅ Créer la table delivery_proximity_suggestions si elle n'existe pas
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

-- ✅ Créer les index nécessaires
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery 
    ON delivery_proximity_suggestions(delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status 
    ON delivery_proximity_suggestions(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_created 
    ON delivery_proximity_suggestions(created_at);

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_created 
    ON delivery_proximity_suggestions(status, created_at);

-- ✅ Commentaire sur la table
COMMENT ON TABLE delivery_proximity_suggestions IS 
    'Suggestions de proximité pour les livraisons - utilisée pour le monitoring toutes les 30s';

-- ✅ Vérification
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'delivery_proximity_suggestions'
        ) THEN '✅ Table delivery_proximity_suggestions créée avec succès'
        ELSE '❌ Erreur: Table non créée'
    END as status;


