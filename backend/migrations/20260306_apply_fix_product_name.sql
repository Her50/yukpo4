-- ✅ CORRECTION 2026-03-06: Fix de la colonne générée product_name
-- Ce script peut être appliqué via gcloud sql instances execute-sql

-- Étape 1: Mettre à jour les produits existants avec 'Produit sans nom' mais ayant des données
UPDATE service_products 
SET product_name = COALESCE(
    product_data->'nom'->>'valeur',
    product_data->'nom_produit'->>'valeur',
    product_data->>'nom',
    product_data->>'nom_produit',
    product_data->>'titre',
    product_data->>'title',
    product_data->>'name',
    'Produit sans nom'
)
WHERE product_name = 'Produit sans nom' 
AND (
    product_data->'nom' IS NOT NULL 
    OR product_data->'nom_produit' IS NOT NULL
    OR product_data->>'nom' IS NOT NULL
    OR product_data->>'nom_produit' IS NOT NULL
    OR product_data->>'titre' IS NOT NULL
    OR product_data->>'title' IS NOT NULL
    OR product_data->>'name' IS NOT NULL
);

-- Étape 2: Recréer la colonne product_name avec la nouvelle définition
-- Note: ALTER COLUMN GENERATED AS n'est pas supporté, donc nous devons recréer
-- La colonne sera recréée automatiquement lors du prochain déploiement avec auto_migrate

-- Log des résultats
DO $$
DECLARE
    corrected_count INTEGER;
BEGIN
    GET DIAGNOSTICS corrected_count = ROW_COUNT;
    RAISE NOTICE '[FIX] product_name corrigé pour % produits', corrected_count;
END $$;
