-- Migration: Corriger les IDs de parcel_types (VERSION 3 - avec désactivation temporaire des contraintes)
-- Date: 2026-01-15
-- Cette version désactive temporairement les contraintes de clé étrangère pour permettre la mise à jour

-- ✅ ÉTAPE 1: Créer une table de mapping
CREATE TEMP TABLE IF NOT EXISTS parcel_types_id_mapping (
    old_id INTEGER,
    new_id INTEGER,
    slug TEXT
);

-- ✅ ÉTAPE 2: Remplir la table de mapping
INSERT INTO parcel_types_id_mapping (old_id, new_id, slug)
SELECT 
    id as old_id,
    CASE slug
        WHEN 'bike' THEN 1
        WHEN 'motorcycle' THEN 2
        WHEN 'tricycle' THEN 3
        WHEN 'car' THEN 4
        WHEN 'pickup' THEN 5
        WHEN 'van' THEN 6
        WHEN 'truck' THEN 7
        WHEN 'walking' THEN 8
    END as new_id,
    slug
FROM parcel_types
WHERE slug IN ('bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking');

-- ✅ ÉTAPE 3: Supprimer temporairement les contraintes de clé étrangère (au lieu de désactiver les triggers système)
DO $$
BEGIN
    -- Supprimer la contrainte sur product_delivery_config si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_delivery_config_required_vehicle_type_id_fkey'
    ) THEN
        ALTER TABLE product_delivery_config 
        DROP CONSTRAINT product_delivery_config_required_vehicle_type_id_fkey;
    END IF;

    -- Supprimer la contrainte sur courier_assets si elle existe (et si la colonne existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'courier_assets_type_id_fkey'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_assets' 
        AND column_name = 'type_id'
    ) THEN
        ALTER TABLE courier_assets 
        DROP CONSTRAINT courier_assets_type_id_fkey;
    END IF;
END $$;

-- ✅ ÉTAPE 4: Mettre à jour les références dans product_delivery_config
UPDATE product_delivery_config pdc
SET required_vehicle_type_id = m.new_id
FROM parcel_types_id_mapping m
WHERE pdc.required_vehicle_type_id = m.old_id
  AND m.old_id != m.new_id;

-- ✅ ÉTAPE 5: Mettre à jour les références dans courier_assets (si la colonne existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_assets' 
        AND column_name = 'type_id'
    ) THEN
        UPDATE courier_assets ca
        SET type_id = m.new_id
        FROM parcel_types_id_mapping m
        WHERE ca.type_id = m.old_id
          AND m.old_id != m.new_id;
    END IF;
END $$;

-- ✅ ÉTAPE 6: Mettre à jour les IDs dans parcel_types
DO $$
DECLARE
    rec RECORD;
    temp_id INTEGER;
BEGIN
    FOR rec IN SELECT old_id, new_id FROM parcel_types_id_mapping WHERE old_id != new_id ORDER BY new_id DESC LOOP
        -- Utiliser un ID temporaire négatif unique pour éviter les conflits
        temp_id := -rec.old_id;
        UPDATE parcel_types SET id = temp_id WHERE id = rec.old_id;
        UPDATE parcel_types SET id = rec.new_id WHERE id = temp_id;
    END LOOP;
END $$;

-- ✅ ÉTAPE 7: Recréer les contraintes de clé étrangère
DO $$
BEGIN
    -- Recréer la contrainte sur product_delivery_config
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'product_delivery_config_required_vehicle_type_id_fkey'
    ) THEN
        ALTER TABLE product_delivery_config 
        ADD CONSTRAINT product_delivery_config_required_vehicle_type_id_fkey 
        FOREIGN KEY (required_vehicle_type_id) REFERENCES parcel_types(id);
    END IF;

    -- Recréer la contrainte sur courier_assets (si la colonne existe)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'courier_assets_type_id_fkey'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'courier_assets' 
        AND column_name = 'type_id'
    ) THEN
        ALTER TABLE courier_assets 
        ADD CONSTRAINT courier_assets_type_id_fkey 
        FOREIGN KEY (type_id) REFERENCES parcel_types(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ✅ ÉTAPE 8: Réinitialiser la séquence
SELECT setval('parcel_types_id_seq', 8, true);

-- ✅ ÉTAPE 9: Vérification
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
END $$;

-- ✅ ÉTAPE 10: Commentaire pour documentation
COMMENT ON TABLE parcel_types IS 'Types de colis alignés avec delivery_engine_type des coursiers. IDs fixes: 1=bike, 2=motorcycle, 3=tricycle, 4=car, 5=pickup, 6=van, 7=truck, 8=walking';

