-- Migration: Table client_delivery_preferences
-- Date: 2025-01-27
-- Description: Préférences de livraison du client (date, heure, flexibilité)

CREATE TABLE IF NOT EXISTS client_delivery_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    
    -- Préférences de livraison
    preferred_delivery_date DATE,
    preferred_delivery_time_start TIME,  -- Ex: 14:00
    preferred_delivery_time_end TIME,    -- Ex: 18:00
    preferred_delivery_window_hours INTEGER DEFAULT 2,  -- Fenêtre de 2h par défaut
    
    -- Contraintes
    avoid_days INTEGER[],  -- Jours à éviter (1=Lundi, 7=Dimanche)
    urgency_level VARCHAR(50) DEFAULT 'standard',  -- 'standard', 'urgent', 'scheduled'
    
    -- Flexibilité
    is_flexible BOOLEAN DEFAULT TRUE,  -- Accepte d'autres créneaux si indisponible
    flexibility_window_days INTEGER DEFAULT 3,  -- Flexibilité sur 3 jours
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_user ON client_delivery_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_delivery ON client_delivery_preferences(delivery_id);
CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_date ON client_delivery_preferences(preferred_delivery_date);

