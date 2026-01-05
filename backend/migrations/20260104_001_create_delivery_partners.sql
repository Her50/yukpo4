-- ✅ NOUVEAU 2026-01-04: Création de la table delivery_partners pour gérer les partenaires de livraison
-- Cette table permet aux administrateurs de créer et gérer des partenaires de logistique
-- qui seront associés aux coursiers lors de leur enregistrement

-- ✅ NOUVEAU 2026-01-04: Créer le type ENUM pour les types de partenaires
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_partner_type') THEN
        CREATE TYPE delivery_partner_type AS ENUM (
            'Livraison',
            'pharmacie',
            'hopital',
            'laboratoire',
            'agence de voyage',
            'demenagement',
            'transport'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS delivery_partners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    partner_type delivery_partner_type NOT NULL DEFAULT 'Livraison',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    website VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON delivery_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_created_by ON delivery_partners(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(partner_type);

-- ✅ NOUVEAU 2026-01-04: Ajouter partner_id à courier_applications
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);

-- ✅ NOUVEAU 2026-01-04: Ajouter vehicle_image_url à courier_assets
ALTER TABLE courier_assets 
ADD COLUMN IF NOT EXISTS vehicle_image_url TEXT;

-- Commentaires pour documentation
COMMENT ON TABLE delivery_partners IS 'Partenaires de livraison (gestionnaires de logistique) qui peuvent être associés aux coursiers';
COMMENT ON COLUMN delivery_partners.partner_type IS 'Type de partenaire: Livraison, pharmacie, hopital, laboratoire, agence de voyage, demenagement, transport';
COMMENT ON COLUMN courier_applications.partner_id IS 'Référence au partenaire de livraison auquel appartient le coursier';
COMMENT ON COLUMN courier_assets.vehicle_image_url IS 'URL de l\'image du moyen de transport du coursier';

