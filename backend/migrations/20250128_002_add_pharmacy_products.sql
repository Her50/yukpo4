-- ✅ NOUVEAU: Migration pour produits de pharmacie

-- Table des produits de pharmacie
CREATE TABLE IF NOT EXISTS pharmacy_products (
    id SERIAL PRIMARY KEY,
    pharmacy_service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    nom_produit VARCHAR(255) NOT NULL,
    description TEXT,
    prix NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    disponible BOOLEAN NOT NULL DEFAULT true,
    unite VARCHAR(50) DEFAULT 'unité', -- "boîte", "flacon", "plaquette", "unité"
    code_barre VARCHAR(100), -- Optionnel
    categorie VARCHAR(100), -- "antalgique", "antibiotique", "vitamine", etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_pharmacy_products_service_id ON pharmacy_products(pharmacy_service_id);
CREATE INDEX idx_pharmacy_products_nom ON pharmacy_products(nom_produit);
CREATE INDEX idx_pharmacy_products_disponible ON pharmacy_products(disponible);
CREATE INDEX idx_pharmacy_products_categorie ON pharmacy_products(categorie);
CREATE INDEX idx_pharmacy_products_prix ON pharmacy_products(prix);

-- Index composite pour recherche avec filtre
CREATE INDEX idx_pharmacy_products_search ON pharmacy_products(pharmacy_service_id, disponible, prix);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_pharmacy_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pharmacy_products_updated_at
    BEFORE UPDATE ON pharmacy_products
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_products_updated_at();

-- Trigger pour mettre à jour disponible selon stock
CREATE OR REPLACE FUNCTION update_pharmacy_products_disponible()
RETURNS TRIGGER AS $$
BEGIN
    NEW.disponible = (NEW.stock > 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pharmacy_products_disponible
    BEFORE INSERT OR UPDATE ON pharmacy_products
    FOR EACH ROW
    EXECUTE FUNCTION update_pharmacy_products_disponible();

