-- Script SQL direct pour nettoyer les services orphelins
-- ATTENTION: Ce script supprime définitivement les services problématiques

-- 1. Désactiver tous les services avec IDs problématiques
UPDATE services 
SET is_active = false, 
    updated_at = NOW() 
WHERE id IN (373989, 275841, 25920, 970545, 508529, 673734, 609012, 862419, 939282, 921100, 518829, 974024, 20977, 742692);

-- 2. Désactiver tous les services avec IDs > 1M (probablement des tests)
UPDATE services 
SET is_active = false, 
    updated_at = NOW() 
WHERE id > 1000000;

-- 3. Vérifier l'état final
SELECT 
    COUNT(*) as total_services,
    COUNT(CASE WHEN is_active = true THEN 1 END) as services_actifs,
    COUNT(CASE WHEN is_active = false THEN 1 END) as services_inactifs,
    MIN(id) as min_id,
    MAX(id) as max_id
FROM services;

-- 4. Lister les services actifs restants
SELECT 
    id, 
    data->>'titre_service' as titre, 
    category, 
    is_active, 
    created_at
FROM services 
WHERE is_active = true 
ORDER BY id; 