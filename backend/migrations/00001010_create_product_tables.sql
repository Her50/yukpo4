-- Tables pour la gestion des produits

-- ✅ 2026-01-03: Table service_products (produits de services séparés du JSONB)
-- Cette table remplace le stockage JSONB dans services.data->'produits'->'valeur'
-- pour améliorer les performances d'ajout et de recherche
CREATE TABLE IF NOT EXISTS service_products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_data JSONB NOT NULL,
    
    -- Métadonnées générées
    product_name TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'nom'->>'valeur',
            product_data->>'nom',
            product_data->'nom_produit'->>'valeur',
            product_data->>'nom_produit',
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
            THEN CAST((product_data->'prix'->'valeur'->>'montant') AS NUMERIC)
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN CAST((product_data->'prix'->>'montant') AS NUMERIC)
            WHEN product_data->>'prix' IS NOT NULL 
            THEN CAST((product_data->>'prix') AS NUMERIC)
            ELSE NULL
        END
    ) STORED,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    UNIQUE(service_id, product_index)
);

-- Index pour performance service_products
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

-- Table products_lifecycle (gestion cycle de vie des produits)
CREATE TABLE IF NOT EXISTS products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    last_reactivated_at TIMESTAMPTZ,
    reactivation_cost INTEGER DEFAULT 1000,
    deactivation_count INTEGER DEFAULT 0,
    total_reactivation_paid INTEGER DEFAULT 0,
    UNIQUE(service_id, product_index)
);

-- Index pour products_lifecycle
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active);
-- ✅ 2025-11-27 : Index composites pour optimiser get_services_for_prestataire
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product ON products_lifecycle (service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product_active ON products_lifecycle (service_id, product_index, is_active);
-- Index pour optimiser la requête principale (user_id + created_at)
CREATE INDEX IF NOT EXISTS idx_services_user_id_created_at_desc ON services (user_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_products_lifecycle_auto_deactivate' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_products_lifecycle_auto_deactivate ON products_lifecycle(auto_deactivate_at) WHERE is_active = TRUE;
    END IF;
END $$;





