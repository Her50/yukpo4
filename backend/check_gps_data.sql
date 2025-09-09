-- Vérification des données GPS dans la base de données
-- Pour comprendre pourquoi la recherche GPS retourne 0 résultats

-- 1. Vérifier le nombre total de services
SELECT 'Nombre total de services' as info, COUNT(*) as valeur FROM services WHERE is_active = true;

-- 2. Vérifier les services avec gps_fixe
SELECT 'Services avec gps_fixe' as info, COUNT(*) as valeur 
FROM services 
WHERE is_active = true 
AND data->>'gps_fixe' IS NOT NULL 
AND data->>'gps_fixe' != '';

-- 3. Vérifier les services avec gps (prestataire)
SELECT 'Services avec gps prestataire' as info, COUNT(*) as valeur 
FROM services 
WHERE is_active = true 
AND gps IS NOT NULL 
AND gps != '';

-- 4. Vérifier les services avec coordonnées GPS valides
SELECT 'Services avec coordonnées GPS valides' as info, COUNT(*) as valeur 
FROM services s
WHERE s.is_active = true 
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '')
);

-- 5. Afficher quelques exemples de services avec leurs coordonnées GPS
SELECT 'Exemples de services avec GPS' as info;
SELECT 
    s.id,
    s.data->>'titre_service' as titre,
    s.data->>'gps_fixe' as gps_fixe,
    s.gps as gps_prestataire,
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN 'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_prestataire'
        ELSE 'aucun'
    END as type_gps
FROM services s
WHERE s.is_active = true 
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '')
)
LIMIT 10;

-- 6. Tester la fonction extract_gps_coordinates sur des données réelles
SELECT 'Test extract_gps_coordinates sur données réelles' as info;
SELECT 
    s.id,
    s.data->>'gps_fixe' as gps_fixe,
    s.gps as gps_prestataire,
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN
            (SELECT COUNT(*) FROM extract_gps_coordinates(s.data->>'gps_fixe'))
        ELSE 0
    END as gps_fixe_count,
    CASE 
        WHEN s.gps IS NOT NULL AND s.gps != '' THEN
            (SELECT COUNT(*) FROM extract_gps_coordinates(s.gps))
        ELSE 0
    END as gps_prestataire_count
FROM services s
WHERE s.is_active = true 
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '')
)
LIMIT 5;

-- 7. Vérifier le format des coordonnées GPS
SELECT 'Format des coordonnées GPS' as info;
SELECT DISTINCT
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN s.data->>'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != '' THEN s.gps
        ELSE NULL
    END as coordonnees_gps,
    CASE 
        WHEN s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '' THEN 'gps_fixe'
        WHEN s.gps IS NOT NULL AND s.gps != '' THEN 'gps_prestataire'
        ELSE 'aucun'
    END as type
FROM services s
WHERE s.is_active = true 
AND (
    (s.data->>'gps_fixe' IS NOT NULL AND s.data->>'gps_fixe' != '') OR
    (s.gps IS NOT NULL AND s.gps != '')
)
LIMIT 10; 