-- Migration: Corriger les IDs de parcel_types pour garantir la cohérence avec le frontend
-- Date: 2026-01-15
-- Problème: Les IDs dans parcel_types peuvent ne pas correspondre à l'ordre attendu par le frontend
-- Solution: Réinitialiser les IDs pour qu'ils correspondent à l'ordre des slugs

-- ✅ SOLUTION OPTIMALE: Mettre à jour les IDs existants pour correspondre à l'ordre attendu
-- L'ordre attendu par le frontend (VEHICLE_TRANSPORT_OPTIONS):
-- 0: bike (ID 1)
-- 1: motorcycle (ID 2)
-- 2: tricycle (ID 3)
-- 3: car (ID 4)
-- 4: pickup (ID 5)
-- 5: van (ID 6)
-- 6: truck (ID 7)
-- 7: walking (ID 8)

-- 1. Mettre à jour les IDs existants pour correspondre à l'ordre attendu
-- L'ordre attendu par le frontend (VEHICLE_TRANSPORT_OPTIONS):
-- 0: bike (ID 1)
-- 1: motorcycle (ID 2)
-- 2: tricycle (ID 3)
-- 3: car (ID 4)
-- 4: pickup (ID 5)
-- 5: van (ID 6)
-- 6: truck (ID 7)
-- 7: walking (ID 8)

-- 4. Mettre à jour les IDs existants pour correspondre à l'ordre attendu
-- On utilise une table de mapping temporaire
DO $$
DECLARE
    bike_id INTEGER;
    motorcycle_id INTEGER;
    tricycle_id INTEGER;
    car_id INTEGER;
    pickup_id INTEGER;
    van_id INTEGER;
    truck_id INTEGER;
    walking_id INTEGER;
BEGIN
    -- Récupérer les IDs actuels
    SELECT id INTO bike_id FROM parcel_types WHERE slug = 'bike' LIMIT 1;
    SELECT id INTO motorcycle_id FROM parcel_types WHERE slug = 'motorcycle' LIMIT 1;
    SELECT id INTO tricycle_id FROM parcel_types WHERE slug = 'tricycle' LIMIT 1;
    SELECT id INTO car_id FROM parcel_types WHERE slug = 'car' LIMIT 1;
    SELECT id INTO pickup_id FROM parcel_types WHERE slug = 'pickup' LIMIT 1;
    SELECT id INTO van_id FROM parcel_types WHERE slug = 'van' LIMIT 1;
    SELECT id INTO truck_id FROM parcel_types WHERE slug = 'truck' LIMIT 1;
    SELECT id INTO walking_id FROM parcel_types WHERE slug = 'walking' LIMIT 1;

    -- Mettre à jour les IDs pour correspondre à l'ordre attendu
    -- On utilise une approche avec des IDs temporaires pour éviter les conflits
    IF bike_id IS NOT NULL AND bike_id != 1 THEN
        UPDATE parcel_types SET id = -1 WHERE id = bike_id;
        UPDATE parcel_types SET id = 1 WHERE id = -1;
    END IF;

    IF motorcycle_id IS NOT NULL AND motorcycle_id != 2 THEN
        UPDATE parcel_types SET id = -2 WHERE id = motorcycle_id;
        UPDATE parcel_types SET id = 2 WHERE id = -2;
    END IF;

    IF tricycle_id IS NOT NULL AND tricycle_id != 3 THEN
        UPDATE parcel_types SET id = -3 WHERE id = tricycle_id;
        UPDATE parcel_types SET id = 3 WHERE id = -3;
    END IF;

    IF car_id IS NOT NULL AND car_id != 4 THEN
        UPDATE parcel_types SET id = -4 WHERE id = car_id;
        UPDATE parcel_types SET id = 4 WHERE id = -4;
    END IF;

    IF pickup_id IS NOT NULL AND pickup_id != 5 THEN
        UPDATE parcel_types SET id = -5 WHERE id = pickup_id;
        UPDATE parcel_types SET id = 5 WHERE id = -5;
    END IF;

    IF van_id IS NOT NULL AND van_id != 6 THEN
        UPDATE parcel_types SET id = -6 WHERE id = van_id;
        UPDATE parcel_types SET id = 6 WHERE id = -6;
    END IF;

    IF truck_id IS NOT NULL AND truck_id != 7 THEN
        UPDATE parcel_types SET id = -7 WHERE id = truck_id;
        UPDATE parcel_types SET id = 7 WHERE id = -7;
    END IF;

    IF walking_id IS NOT NULL AND walking_id != 8 THEN
        UPDATE parcel_types SET id = -8 WHERE id = walking_id;
        UPDATE parcel_types SET id = 8 WHERE id = -8;
    END IF;

    -- Réinitialiser la séquence pour commencer à 9 (après les 8 types)
    PERFORM setval('parcel_types_id_seq', 8, true);
END $$;

-- 5. Vérification: S'assurer que tous les types ont les bons IDs
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

-- 6. Commentaire pour documentation
COMMENT ON TABLE parcel_types IS 'Types de colis alignés avec delivery_engine_type des coursiers. IDs fixes: 1=bike, 2=motorcycle, 3=tricycle, 4=car, 5=pickup, 6=van, 7=truck, 8=walking';

