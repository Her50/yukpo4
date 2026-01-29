-- Migration: Table client_delivery_preferences
-- Date: 2025-01-27
-- Description: Préférences de livraison du client (date, heure, flexibilité)

-- ✅ CORRIGÉ 2026-01-29: Créer la table sans contrainte FK d'abord, puis l'ajouter conditionnellement
CREATE TABLE IF NOT EXISTS client_delivery_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID,
    
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

-- ✅ CORRIGÉ 2026-01-29: Ajouter la contrainte de clé étrangère seulement si deliveries existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'client_delivery_preferences' 
            AND constraint_name = 'client_delivery_preferences_delivery_id_fkey'
        ) THEN
            ALTER TABLE client_delivery_preferences
                ADD CONSTRAINT client_delivery_preferences_delivery_id_fkey
                FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

