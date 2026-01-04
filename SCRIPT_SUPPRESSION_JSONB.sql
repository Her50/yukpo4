-- Script SQL pour supprimer les données produits du JSONB dans services.data
-- Date: 2026-01-03
-- Objectif: Nettoyer services.data->'produits' car migration complète vers table service_products

-- ✅ Supprimer le champ 'produits' de services.data pour tous les services
UPDATE services
SET data = data - 'produits',
    updated_at = NOW()
WHERE data ? 'produits';

-- ✅ Vérifier le résultat
SELECT 
    id,
    data->'produits' as produits_jsonb,
    (SELECT COUNT(*) FROM service_products WHERE service_id = services.id) as produits_dans_table
FROM services
WHERE data ? 'produits'
LIMIT 10;

-- ✅ Statistiques
SELECT 
    COUNT(*) as total_services,
    COUNT(*) FILTER (WHERE data ? 'produits') as services_avec_produits_jsonb,
    (SELECT COUNT(DISTINCT service_id) FROM service_products) as services_avec_produits_table
FROM services;

