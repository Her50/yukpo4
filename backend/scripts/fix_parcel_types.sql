-- Script SQL pour vérifier et corriger les types de colis
-- Usage: psql -h host -U user -d database -f scripts/fix_parcel_types.sql

-- 1. Afficher les types de colis actuels
\echo '📦 Types de colis actuels:'
SELECT 
    id,
    slug,
    display_name,
    description,
    max_weight_kg,
    max_volume_cm3,
    created_at
FROM parcel_types
ORDER BY id;

-- 2. Vérifier si les types attendus existent
\echo ''
\echo '✅ Vérification des types attendus (basés sur véhicules):'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'bike') THEN '✅ bike'
        ELSE '❌ bike MANQUANT'
    END as bike,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'motorcycle') THEN '✅ motorcycle'
        ELSE '❌ motorcycle MANQUANT'
    END as motorcycle,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'tricycle') THEN '✅ tricycle'
        ELSE '❌ tricycle MANQUANT'
    END as tricycle,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'car') THEN '✅ car'
        ELSE '❌ car MANQUANT'
    END as car,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'pickup') THEN '✅ pickup'
        ELSE '❌ pickup MANQUANT'
    END as pickup,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'van') THEN '✅ van'
        ELSE '❌ van MANQUANT'
    END as van,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'truck') THEN '✅ truck'
        ELSE '❌ truck MANQUANT'
    END as truck,
    CASE 
        WHEN EXISTS (SELECT 1 FROM parcel_types WHERE slug = 'walking') THEN '✅ walking'
        ELSE '❌ walking MANQUANT'
    END as walking;

-- 3. Si des types manquent, les créer
\echo ''
\echo '🔧 Insertion des types manquants...'

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

-- 4. Afficher les types après correction
\echo ''
\echo '📦 Types de colis après correction:'
SELECT 
    id,
    slug,
    display_name,
    description
FROM parcel_types
ORDER BY id;

\echo ''
\echo '✅ Vérification terminée!'



