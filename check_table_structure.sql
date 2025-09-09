-- Vérifier la structure de la table services
\d services;

-- Voir quelques exemples de services existants
SELECT id, name, description, category, is_active FROM services LIMIT 5; 