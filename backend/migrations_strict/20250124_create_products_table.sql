-- Migration: Création de la table products pour les fonctionnalités de réservation et de gestion dédiées
-- Date: 2025-01-24
-- Contexte:
--   Certaines fonctionnalités (ex. réservations de bus) manipulent une table `products`
--   distincte des données produits stockées dans `services.data`.
--   La réinitialisation de la base de tests a supprimé cette table,
--   ce qui provoque des erreurs dans les migrations suivantes (ALTER TABLE products ...).
-- Objectif:
--   Recréer la table `products` minimalement pour satisfaire ces fonctionnalités
--   tout en laissant la logique métier principale inchangée.
-- Remarque:
--   Tous les champs sont en ASCII. Les colonnes ajoutées ultérieurement (bus_reservations, etc.)
--   s'appuient sur cette structure.

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    price_cents BIGINT,
    currency VARCHAR(10) DEFAULT 'XAF',
    seat_map JSONB,
    bus_configuration JSONB,
    total_seats INTEGER,
    numero_bus VARCHAR(50),
    logo_agence TEXT,
    conditions_voyage TEXT,
    caution_reservation INTEGER DEFAULT 500,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE products IS 'Table physique pour les produits structurés (ex: tickets de bus) distincts de services.data->produits';
COMMENT ON COLUMN products.id IS 'Identifiant unique du produit (UUID)';
COMMENT ON COLUMN products.service_id IS 'Service propriétaire du produit';
COMMENT ON COLUMN products.type IS 'Type fonctionnel du produit (ex: ticket_voyage, abonnement, etc.)';
COMMENT ON COLUMN products.seat_map IS 'Plan de sièges JSONB pour les produits de type transport';
COMMENT ON COLUMN products.bus_configuration IS 'Configuration détaillée du bus (rows, seats_per_row, etc.)';

CREATE INDEX IF NOT EXISTS idx_products_service_id ON products(service_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Trigger pour tenir updated_at à jour
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();


