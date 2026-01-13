-- Migration: Corriger les IDs de parcel_types pour garantir la cohérence avec le frontend (VERSION 2)
-- Date: 2026-01-15
-- Problème: Les IDs dans parcel_types peuvent ne pas correspondre à l'ordre attendu par le frontend
-- Solution: Mettre à jour les références puis les IDs

-- ✅ ÉTAPE 1: Créer une table de mapping temporaire pour stocker les anciens et nouveaux IDs
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

-- ✅ ÉTAPE 3: Mettre à jour toutes les références dans product_delivery_config
UPDATE product_delivery_config pdc
SET required_vehicle_type_id = m.new_id
FROM parcel_types_id_mapping m
WHERE pdc.required_vehicle_type_id = m.old_id
  AND m.old_id != m.new_id;

-- ✅ ÉTAPE 4: Mettre à jour toutes les références dans courier_assets
UPDATE courier_assets ca
SET type_id = m.new_id
FROM parcel_types_id_mapping m
WHERE ca.type_id = m.old_id
  AND m.old_id != m.new_id;

-- ✅ ÉTAPE 5: Mettre à jour les IDs dans parcel_types en utilisant des IDs temporaires négatifs
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT old_id, new_id FROM parcel_types_id_mapping WHERE old_id != new_id LOOP
        -- Utiliser un ID temporaire négatif unique pour éviter les conflits
        UPDATE parcel_types SET id = -rec.old_id WHERE id = rec.old_id;
        UPDATE parcel_types SET id = rec.new_id WHERE id = -rec.old_id;
    END LOOP;
END $$;

-- ✅ ÉTAPE 6: Réinitialiser la séquence
SELECT setval('parcel_types_id_seq', 8, true);

-- ✅ ÉTAPE 7: Vérification
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

-- ✅ ÉTAPE 8: Commentaire pour documentation
COMMENT ON TABLE parcel_types IS 'Types de colis alignés avec delivery_engine_type des coursiers. IDs fixes: 1=bike, 2=motorcycle, 3=tricycle, 4=car, 5=pickup, 6=van, 7=truck, 8=walking';

