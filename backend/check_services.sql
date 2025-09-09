-- Vérifier les services spécifiques trouvés dans Pinecone
SELECT id, titre_service, category FROM services WHERE id IN (92, 93, 518829, 532476, 742513, 492555) ORDER BY id;

-- Vérifier tous les services de restauration
SELECT id, titre_service, category FROM services WHERE category ILIKE '%restaurant%' OR category ILIKE '%restauration%' ORDER BY id;

-- Vérifier les services avec des IDs similaires
SELECT id, titre_service, category FROM services WHERE id BETWEEN 90 AND 100 ORDER BY id;

-- Compter le nombre total de services
SELECT COUNT(*) as total_services FROM services; 