-- Vérification du nombre de services en base de données
SELECT 
    COUNT(*) as total_services,
    COUNT(CASE WHEN category = 'Restauration' THEN 1 END) as services_restauration,
    COUNT(CASE WHEN category = 'Coiffure' THEN 1 END) as services_coiffure,
    COUNT(CASE WHEN category = 'Beaute' THEN 1 END) as services_beaute
FROM services;

-- Afficher quelques exemples de services
SELECT 
    id,
    titre,
    category,
    description,
    created_at
FROM services 
ORDER BY created_at DESC 
LIMIT 10; 