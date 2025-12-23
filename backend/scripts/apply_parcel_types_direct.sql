-- Migration directe pour aligner parcel_types avec les types de véhicules
-- Date: 2025-12-22
-- Usage: psql $DATABASE_URL -f backend/scripts/apply_parcel_types_direct.sql

-- 1. Supprimer les anciens parcel_types qui ne correspondent pas aux véhicules
DELETE FROM parcel_types WHERE slug NOT IN (
    'bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking'
);

-- 2. Insérer les types de colis alignés avec delivery_engine_type
INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata)
VALUES
    ('bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb),
    ('motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb),
    ('tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb),
    ('car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb),
    ('pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb),
    ('van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb),
    ('truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb),
    ('walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    max_weight_kg = EXCLUDED.max_weight_kg,
    max_volume_cm3 = EXCLUDED.max_volume_cm3,
    metadata = EXCLUDED.metadata;

-- 3. Afficher les types après migration
SELECT id, slug, display_name, description FROM parcel_types ORDER BY id;


