-- Insertion de services de test avec GPS pour tester la recherche
-- ==============================================================

-- 1. Nettoyer les anciens services de test
DELETE FROM services WHERE data->>'titre_service' LIKE 'TEST_%';

-- 2. Insérer des services de test avec GPS dans la zone de recherche
-- Zone GPS du frontend: "4.218475218080653,9.65788571424782|3.7458350177633495,9.73204342909157|3.985613976596999,10.211321993544695"

-- Service 1: Restaurant dans la zone (près du premier point)
INSERT INTO services (data) VALUES (
    '{
        "titre_service": "TEST_Restaurant_Le_Bon_Goût",
        "description": "Restaurant traditionnel camerounais avec spécialités locales",
        "category": "restaurant",
        "gps_fixe": {
            "valeur": "4.218475218080653,9.65788571424782",
            "type_donnee": "gps"
        },
        "prix": 5000,
        "ville": "Douala",
        "quartier": "Centre-ville"
    }'::jsonb
);

-- Service 2: Restaurant dans la zone (près du deuxième point)
INSERT INTO services (data) VALUES (
    '{
        "titre_service": "TEST_Restaurant_La_Savane",
        "description": "Restaurant africain avec vue panoramique",
        "category": "restaurant",
        "gps_fixe": {
            "valeur": "3.7458350177633495,9.73204342909157",
            "type_donnee": "gps"
        },
        "prix": 3500,
        "ville": "Douala",
        "quartier": "Akwa"
    }'::jsonb
);

-- Service 3: Restaurant dans la zone (près du troisième point)
INSERT INTO services (data) VALUES (
    '{
        "titre_service": "TEST_Restaurant_Le_Port",
        "description": "Restaurant de fruits de mer au bord de l'eau",
        "category": "restaurant",
        "gps_fixe": {
            "valeur": "3.985613976596999,10.211321993544695",
            "type_donnee": "gps"
        },
        "prix": 8000,
        "ville": "Douala",
        "quartier": "Port"
    }'::jsonb
);

-- Service 4: Restaurant au centre de la zone (pour test de rayon)
INSERT INTO services (data) VALUES (
    '{
        "titre_service": "TEST_Restaurant_Centre_Zone",
        "description": "Restaurant central avec cuisine internationale",
        "category": "restaurant",
        "gps_fixe": {
            "valeur": "3.98,9.85",
            "type_donnee": "gps"
        },
        "prix": 6000,
        "ville": "Douala",
        "quartier": "Zone_Centrale"
    }'::jsonb
);

-- Service 5: Restaurant juste en dehors de la zone (pour tester le filtrage)
INSERT INTO services (data) VALUES (
    '{
        "titre_service": "TEST_Restaurant_Hors_Zone",
        "description": "Restaurant trop éloigné pour être trouvé",
        "category": "restaurant",
        "gps_fixe": {
            "valeur": "2.0,8.0",
            "type_donnee": "gps"
        },
        "prix": 4000,
        "ville": "Yaoundé",
        "quartier": "Centre"
    }'::jsonb
);

-- Service 6: Service sans GPS (pour tester le fallback)
INSERT INTO services (data) VALUES (
    '{
        "titre_service": "TEST_Restaurant_Sans_GPS",
        "description": "Restaurant sans coordonnées GPS",
        "category": "restaurant",
        "prix": 3000,
        "ville": "Douala",
        "quartier": "Inconnu"
    }'::jsonb
);

-- 3. Vérifier l'insertion
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category' as categorie,
    data->'gps_fixe' as gps_data,
    extract_gps_from_json(data->'gps_fixe') as gps_extrait
FROM services 
WHERE data->>'titre_service' LIKE 'TEST_%'
ORDER BY id;

-- 4. Compter les services de test
SELECT 
    COUNT(*) as total_test_services,
    COUNT(CASE WHEN data->'gps_fixe' IS NOT NULL THEN 1 END) as avec_gps,
    COUNT(CASE WHEN data->'gps_fixe' IS NULL THEN 1 END) as sans_gps
FROM services 
WHERE data->>'titre_service' LIKE 'TEST_%'; 