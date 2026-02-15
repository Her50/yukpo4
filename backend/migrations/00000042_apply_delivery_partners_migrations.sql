-- ✅ NOUVEAU 2026-01-04: Migration complète pour delivery_partners
-- Ce script applique toutes les migrations nécessaires pour les partenaires de livraison

-- 1. Créer l'enum delivery_partner_type avec 'livraison' en minuscule
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_partner_type') THEN
        CREATE TYPE delivery_partner_type AS ENUM (
            'livraison',
            'livraison_courses_marche',
            'pharmacie',
            'hopital',
            'laboratoire',
            'agence de voyage',
            'demenagement',
            'transport',
            'assureur',
            'supermarche',
            'telecom',
            'chauffeur'
        );
    END IF;
END
$$;

-- 2. Ajouter 'livraison' à l'enum si n'existe pas (pour les bases existantes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'livraison' AND enumtypid = 'delivery_partner_type'::regtype
    ) THEN
        ALTER TYPE delivery_partner_type ADD VALUE 'livraison';
    END IF;
END
$$;

-- 3. Ajouter les nouveaux types de partenaires à l'enum
DO $$
BEGIN
    -- Ajouter 'assureur' si n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'assureur' AND enumtypid = 'delivery_partner_type'::regtype
    ) THEN
        ALTER TYPE delivery_partner_type ADD VALUE 'assureur';
    END IF;
    
    -- Ajouter 'supermarche' si n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'supermarche' AND enumtypid = 'delivery_partner_type'::regtype
    ) THEN
        ALTER TYPE delivery_partner_type ADD VALUE 'supermarche';
    END IF;
    
    -- Ajouter 'telecom' si n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'telecom' AND enumtypid = 'delivery_partner_type'::regtype
    ) THEN
        ALTER TYPE delivery_partner_type ADD VALUE 'telecom';
    END IF;
    
    -- ✅ NOUVEAU: Ajouter 'livraison_courses_marche' si n'existe pas (pour coursiers spécialisés en courses au marché)
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'livraison_courses_marche' AND enumtypid = 'delivery_partner_type'::regtype
    ) THEN
        ALTER TYPE delivery_partner_type ADD VALUE 'livraison_courses_marche';
    END IF;
    
    -- ✅ NOUVEAU: Ajouter 'chauffeur' si n'existe pas (pour chauffeurs taxi/covoiturage)
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'chauffeur' AND enumtypid = 'delivery_partner_type'::regtype
    ) THEN
        ALTER TYPE delivery_partner_type ADD VALUE 'chauffeur';
    END IF;
END
$$;

-- 4. Créer la table delivery_partners si elle n'existe pas
CREATE TABLE IF NOT EXISTS delivery_partners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    partner_type delivery_partner_type NOT NULL DEFAULT 'livraison',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'Non spécifié', -- ✅ NOUVEAU 2026-01-04: Pays obligatoire
    continent VARCHAR(50), -- ✅ NOUVEAU 2026-01-04: Continent optionnel
    website VARCHAR(255),
    logo_url TEXT,
    -- ✅ NOUVEAU 2026-01-04: Localisation intelligente du partenaire
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    location_address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Modifier la contrainte UNIQUE pour permettre le même nom dans différents pays
DO $$
BEGIN
    -- Supprimer l'ancienne contrainte UNIQUE sur name si elle existe
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'delivery_partners_name_key' 
        AND conrelid = 'delivery_partners'::regclass
    ) THEN
        ALTER TABLE delivery_partners DROP CONSTRAINT delivery_partners_name_key;
    END IF;
    
    -- Ajouter la nouvelle contrainte UNIQUE sur (name, country) si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'delivery_partners_name_country_key' 
        AND conrelid = 'delivery_partners'::regclass
    ) THEN
        ALTER TABLE delivery_partners ADD CONSTRAINT delivery_partners_name_country_key UNIQUE (name, country);
    END IF;
END
$$;

-- 6. Ajouter la colonne country si elle n'existe pas et la rendre NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_partners' AND column_name = 'country'
    ) THEN
        ALTER TABLE delivery_partners ADD COLUMN country VARCHAR(100) DEFAULT 'Non spécifié';
    END IF;
    
    -- Mettre à jour les valeurs NULL avec une valeur par défaut
    UPDATE delivery_partners SET country = 'Non spécifié' WHERE country IS NULL;
    
    -- Rendre country NOT NULL si ce n'est pas déjà le cas
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_partners' 
        AND column_name = 'country' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE delivery_partners ALTER COLUMN country SET NOT NULL;
    END IF;
END
$$;

-- 7. Ajouter la colonne continent si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_partners' AND column_name = 'continent'
    ) THEN
        ALTER TABLE delivery_partners ADD COLUMN continent VARCHAR(50);
    END IF;
END
$$;

-- 8. Ajouter les colonnes de localisation si elles n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_partners' AND column_name = 'location_latitude'
    ) THEN
        ALTER TABLE delivery_partners 
        ADD COLUMN location_latitude DOUBLE PRECISION,
        ADD COLUMN location_longitude DOUBLE PRECISION,
        ADD COLUMN location_address TEXT;
    END IF;
END
$$;

-- 9. Ajouter la colonne partner_type si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_partners' AND column_name = 'partner_type'
    ) THEN
        ALTER TABLE delivery_partners 
        ADD COLUMN partner_type delivery_partner_type NOT NULL DEFAULT 'livraison';
    END IF;
END
$$;

-- 10. Mettre à jour 'Livraison' en 'livraison' dans les données existantes
UPDATE delivery_partners 
SET partner_type = 'livraison'::delivery_partner_type 
WHERE partner_type::text = 'Livraison';

-- 11. Créer les index
CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON delivery_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_created_by ON delivery_partners(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_country ON delivery_partners(country);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_continent ON delivery_partners(continent);

-- 12. Ajouter partner_id à courier_applications si n'existe pas
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);

-- 13. Ajouter vehicle_image_url à courier_assets si n'existe pas
ALTER TABLE courier_assets 
ADD COLUMN IF NOT EXISTS vehicle_image_url TEXT;

-- 14. Ajouter la contrainte CHECK sur users.role pour inclure 'partenaire' et 'super_admin'
DO $$
DECLARE
    constraint_def TEXT;
    constraint_exists BOOLEAN;
BEGIN
    -- Vérifier si la contrainte existe déjà
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_role_check' 
        AND conrelid = 'users'::regclass
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        -- Récupérer la définition actuelle de la contrainte
        SELECT pg_get_constraintdef(oid) INTO constraint_def
        FROM pg_constraint
        WHERE conname = 'users_role_check' 
        AND conrelid = 'users'::regclass;
        
        -- Si la contrainte ne contient pas 'super_admin', on la recrée
        IF constraint_def NOT LIKE '%super_admin%' THEN
            ALTER TABLE users DROP CONSTRAINT users_role_check;
            ALTER TABLE users ADD CONSTRAINT users_role_check 
            CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'));
            RAISE NOTICE 'Contrainte users_role_check mise a jour avec super_admin';
        ELSE
            RAISE NOTICE 'Contrainte users_role_check deja a jour avec super_admin';
        END IF;
    ELSE
        -- La contrainte n'existe pas, on la crée avec tous les rôles
        ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'));
        RAISE NOTICE 'Contrainte users_role_check creee avec super_admin et partenaire';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Contrainte users_role_check deja presente';
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la mise a jour de la contrainte: %', SQLERRM;
END
$$;

-- ✅ Migration terminée
SELECT '✅ Migrations delivery_partners appliquées avec succès' AS status;


