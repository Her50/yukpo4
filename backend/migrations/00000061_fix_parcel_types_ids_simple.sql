-- Migration: Corriger les IDs de parcel_types (VERSION SIMPLE - suppression/recréation)
-- Date: 2026-01-15
-- Cette version supprime et recrée les enregistrements au lieu d'utiliser des UPDATE complexes

-- ✅ ÉTAPE 1: Sauvegarder les mappings slug -> old_id depuis les tables référencées
CREATE TEMP TABLE IF NOT EXISTS parcel_types_backup AS
SELECT 
    pt.id as old_id,
    pt.slug,
    pt.display_name,
    pt.description,
    pt.max_weight_kg,
    pt.max_volume_cm3,
    pt.requires_isothermal,
    pt.requires_fragile_handling,
    pt.requires_secure_box,
    pt.requires_document_protection,
    pt.metadata,
    pt.created_at
FROM parcel_types pt;

-- ✅ ÉTAPE 2: Sauvegarder les références dans product_delivery_config avec les slugs
CREATE TEMP TABLE IF NOT EXISTS product_delivery_config_backup AS
SELECT 
    pdc.id,
    pdc.service_id,
    pdc.product_index,
    pdc.pickup_address,
    pdc.pickup_latitude,
    pdc.pickup_longitude,
    pt.slug as vehicle_type_slug,
    pdc.weight_kg,
    pdc.volume_cm3,
    pdc.requires_isothermal,
    pdc.requires_fragile_handling,
    pdc.pickup_availability_schedule,
    pdc.pickup_instructions,
    pdc.billing_mode,
    pdc.billing_partner_label,
    pdc.is_configured,
    pdc.configured_at,
    pdc.configured_by,
    pdc.created_at,
    pdc.updated_at
FROM product_delivery_config pdc
LEFT JOIN parcel_types pt ON pt.id = pdc.required_vehicle_type_id;

-- ✅ ÉTAPE 3: Sauvegarder les références dans courier_assets avec les slugs (si la colonne type_id existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_assets' AND column_name = 'type_id'
    ) THEN
        CREATE TEMP TABLE IF NOT EXISTS courier_assets_backup AS
        SELECT 
            ca.id,
            ca.courier_id,
            pt.slug as vehicle_type_slug,
            ca.created_at,
            ca.updated_at
        FROM courier_assets ca
        LEFT JOIN parcel_types pt ON pt.id = ca.type_id;
    ELSE
        -- Créer une table vide si la colonne n'existe pas
        CREATE TEMP TABLE IF NOT EXISTS courier_assets_backup (
            id UUID,
            courier_id UUID,
            vehicle_type_slug TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        );
    END IF;
END $$;

-- ✅ ÉTAPE 4: Supprimer temporairement les contraintes de clé étrangère
DO $$
BEGIN
    -- Supprimer la contrainte sur product_delivery_config si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_delivery_config_required_vehicle_type_id_fkey'
        AND table_name = 'product_delivery_config'
    ) THEN
        ALTER TABLE product_delivery_config 
        DROP CONSTRAINT product_delivery_config_required_vehicle_type_id_fkey;
    END IF;

    -- Supprimer la contrainte sur courier_assets si elle existe (et si la colonne type_id existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'courier_assets_type_id_fkey'
        AND table_name = 'courier_assets'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_assets' AND column_name = 'type_id'
    ) THEN
        ALTER TABLE courier_assets 
        DROP CONSTRAINT courier_assets_type_id_fkey;
    END IF;
END $$;

-- ✅ ÉTAPE 5: Supprimer tous les enregistrements de parcel_types
DELETE FROM parcel_types;

-- ✅ ÉTAPE 6: Recréer les enregistrements avec les IDs corrects (1-8)
INSERT INTO parcel_types (id, slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata, created_at)
VALUES
    (1, 'bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb, NOW()),
    (2, 'motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb, NOW()),
    (3, 'tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb, NOW()),
    (4, 'car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb, NOW()),
    (5, 'pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb, NOW()),
    (6, 'van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb, NOW()),
    (7, 'truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb, NOW()),
    (8, 'walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ✅ ÉTAPE 7: Mettre à jour les références dans product_delivery_config en utilisant les slugs
UPDATE product_delivery_config pdc
SET required_vehicle_type_id = pt.id
FROM product_delivery_config_backup pdcb
JOIN parcel_types pt ON pt.slug = pdcb.vehicle_type_slug
WHERE pdc.id = pdcb.id
  AND pdcb.vehicle_type_slug IS NOT NULL;

-- ✅ ÉTAPE 8: Mettre à jour les références dans courier_assets en utilisant les slugs (si la colonne type_id existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_assets' AND column_name = 'type_id'
    ) THEN
        -- La table courier_assets_backup a été créée à l'étape 3 si la colonne existe
        UPDATE courier_assets ca
        SET type_id = pt.id
        FROM courier_assets_backup cab
        JOIN parcel_types pt ON pt.slug = cab.vehicle_type_slug
        WHERE ca.id = cab.id
          AND cab.vehicle_type_slug IS NOT NULL;
    END IF;
END $$;

-- ✅ ÉTAPE 9: Recréer les contraintes de clé étrangère
DO $$
BEGIN
    -- Recréer la contrainte sur product_delivery_config
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_delivery_config_required_vehicle_type_id_fkey'
        AND table_name = 'product_delivery_config'
    ) THEN
        ALTER TABLE product_delivery_config 
        ADD CONSTRAINT product_delivery_config_required_vehicle_type_id_fkey 
        FOREIGN KEY (required_vehicle_type_id) REFERENCES parcel_types(id);
    END IF;

    -- Recréer la contrainte sur courier_assets (si la colonne type_id existe)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'courier_assets_type_id_fkey'
        AND table_name = 'courier_assets'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courier_assets' AND column_name = 'type_id'
    ) THEN
        ALTER TABLE courier_assets 
        ADD CONSTRAINT courier_assets_type_id_fkey 
        FOREIGN KEY (type_id) REFERENCES parcel_types(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ✅ ÉTAPE 10: Réinitialiser la séquence
SELECT setval('parcel_types_id_seq', 8, true);

-- ✅ ÉTAPE 11: Vérification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'bike' AND id = 1) THEN
        RAISE EXCEPTION 'Erreur: bike doit avoir l''ID 1';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'motorcycle' AND id = 2) THEN
        RAISE EXCEPTION 'Erreur: motorcycle doit avoir l''ID 2';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'tricycle' AND id = 3) THEN
        RAISE EXCEPTION 'Erreur: tricycle doit avoir l''ID 3';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'car' AND id = 4) THEN
        RAISE EXCEPTION 'Erreur: car doit avoir l''ID 4';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'pickup' AND id = 5) THEN
        RAISE EXCEPTION 'Erreur: pickup doit avoir l''ID 5';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'van' AND id = 6) THEN
        RAISE EXCEPTION 'Erreur: van doit avoir l''ID 6';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'truck' AND id = 7) THEN
        RAISE EXCEPTION 'Erreur: truck doit avoir l''ID 7';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'walking' AND id = 8) THEN
        RAISE EXCEPTION 'Erreur: walking doit avoir l''ID 8';
    END IF;
    
    RAISE NOTICE 'Migration réussie: tous les IDs de parcel_types sont corrects';
END $$;

-- ✅ ÉTAPE 12: Commentaire pour documentation
COMMENT ON TABLE parcel_types IS 'Types de colis alignés avec delivery_engine_type des coursiers. IDs fixes: 1=bike, 2=motorcycle, 3=tricycle, 4=car, 5=pickup, 6=van, 7=truck, 8=walking';

