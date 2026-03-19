-- Migration: Table service_products séparée pour améliorer les performances
-- Date: 2026-01-03
-- Objectif: Résoudre les problèmes de performance lors de l'ajout de produits
-- Note: Cette migration crée la table service_products pour les produits de services
-- (remplace le stockage JSONB dans services.data->'produits'->'valeur')
-- IMPORTANT: La table products (UUID) pour tickets de bus est préservée et non modifiée

-- Créer la table service_products avec notre nouvelle structure
CREATE TABLE IF NOT EXISTS service_products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_data JSONB NOT NULL,
    
    -- Métadonnées générées
    product_name TEXT GENERATED ALWAYS AS (
        COALESCE(
            -- Cas 1: nom.valeur (format formulaire dynamique)
            product_data->'nom'->>'valeur',
            -- Cas 2: nom_produit.valeur (format formulaire dynamique)
            product_data->'nom_produit'->>'valeur',
            -- Cas 3: nom direct (format simple)
            product_data->>'nom',
            -- Cas 4: nom_produit direct (format simple)
            product_data->>'nom_produit',
            -- Cas 5: titre (fallback)
            product_data->>'titre',
            -- Cas 6: title (fallback anglais)
            product_data->>'title',
            -- Cas 7: name (fallback anglais)
            product_data->>'name',
            -- Fallback final
            'Produit sans nom'
        )
    ) STORED,
    
    product_type TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'type'->>'valeur',
            product_data->>'type',
            'autre'
        )
    ) STORED,
    
    product_price NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->>'montant')::NUMERIC
            WHEN product_data->>'prix' IS NOT NULL 
            THEN (product_data->>'prix')::NUMERIC
            ELSE NULL
        END
    ) STORED,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    UNIQUE(service_id, product_index)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON service_products(service_id);
CREATE INDEX IF NOT EXISTS idx_service_products_active ON service_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_products_type ON service_products(product_type);
CREATE INDEX IF NOT EXISTS idx_service_products_name_gin ON service_products USING GIN(to_tsvector('french', product_name));
CREATE INDEX IF NOT EXISTS idx_service_products_data_gin ON service_products USING GIN(product_data);
CREATE INDEX IF NOT EXISTS idx_service_products_service_index ON service_products(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_service_products_created_at ON service_products(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_service_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_products_updated_at ON service_products;
CREATE TRIGGER trg_service_products_updated_at
    BEFORE UPDATE ON service_products
    FOR EACH ROW
    EXECUTE FUNCTION update_service_products_updated_at();

COMMENT ON TABLE service_products IS 'Table séparée pour les produits de services. Améliore les performances d''ajout et de recherche par rapport au JSONB dans services.data';
COMMENT ON COLUMN service_products.product_index IS 'Position du produit dans l''ordre d''affichage (0, 1, 2, ...). Doit être unique par service.';
COMMENT ON COLUMN service_products.product_data IS 'Toutes les données du produit au format JSONB (nom, prix, description, type, images, etc.)';
