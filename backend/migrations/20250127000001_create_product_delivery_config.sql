-- Migration: Création de la table product_delivery_config
-- Date: 2025-01-27
-- Description: Configuration de livraison obligatoire par produit pour activation

CREATE TABLE IF NOT EXISTS product_delivery_config (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    
    -- Pickup (obligatoire)
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    
    -- Type véhicule (obligatoire)
    required_vehicle_type_id INTEGER NOT NULL REFERENCES parcel_types(id),
    weight_kg DOUBLE PRECISION,
    volume_cm3 DOUBLE PRECISION,
    requires_isothermal BOOLEAN DEFAULT FALSE,
    requires_fragile_handling BOOLEAN DEFAULT FALSE,
    
    -- Plages horaires de récupération (obligatoire)
    pickup_availability_schedule JSONB NOT NULL,  -- Format structuré ci-dessous
    
    -- Informations additionnelles
    pickup_instructions TEXT,
    billing_mode VARCHAR(50) DEFAULT 'standard',  -- 'standard' ou 'merchant_inclusive'
    billing_partner_label TEXT,  -- Si livraison incluse dans le prix
    
    -- Statut
    is_configured BOOLEAN DEFAULT FALSE,  -- TRUE quand tous les champs requis sont remplis
    configured_at TIMESTAMPTZ,
    configured_by INTEGER REFERENCES users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_id, product_index)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_service ON product_delivery_config(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_product_delivery_config_active ON product_delivery_config(is_configured) WHERE is_configured = TRUE;

-- Commentaire sur le format JSONB pour pickup_availability_schedule :
-- {
--   "monday": [{"start": "08:00", "end": "18:00"}],
--   "tuesday": [{"start": "08:00", "end": "18:00"}],
--   "wednesday": [{"start": "08:00", "end": "18:00"}],
--   "thursday": [{"start": "08:00", "end": "18:00"}],
--   "friday": [{"start": "08:00", "end": "18:00"}],
--   "saturday": [{"start": "09:00", "end": "14:00"}],
--   "sunday": null  -- ou [] si fermé
-- }

