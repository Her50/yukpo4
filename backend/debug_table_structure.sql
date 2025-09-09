-- Vérifier la structure de la table services
\d services;

-- Vérifier les services existants
SELECT id, is_active, created_at, user_id FROM services ORDER BY id LIMIT 10;

-- Vérifier les services spécifiques mentionnés dans les logs
SELECT id, is_active, created_at, user_id FROM services WHERE id IN (531974, 862419, 20977, 518829, 939282, 742692, 27) ORDER BY id;

-- Vérifier la structure des données JSON
SELECT id, json_typeof(data) as data_type, data->>'titre_service' as titre FROM services WHERE id IN (531974, 27) LIMIT 5; 