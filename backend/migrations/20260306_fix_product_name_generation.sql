-- ✅ CORRECTION 2026-03-06: Fix de la colonne générée product_name
-- Problème: Le premier produit créé lors de la création du service utilise parfois
-- la structure {valeur: "..."} mais la colonne product_name ne gérait que certains cas
-- Cela causait un product_name = 'Produit sans nom' et un score de recherche = 0

-- Supprimer et recréer la colonne product_name avec une meilleure extraction
ALTER TABLE service_products DROP COLUMN IF EXISTS product_name;

-- Recréer la colonne avec une extraction plus robuste qui gère TOUS les cas
ALTER TABLE service_products ADD COLUMN product_name TEXT GENERATED ALWAYS AS (
    COALESCE(
        -- Cas 1: nom.valeur (format formulaire dynamique)
        product_data->'nom'->>'valeur',
        -- Cas 2: nom_produit.valeur (format formulaire dynamique)
        product_data->'nom_produit'->>'valeur',
        -- Cas 3: nom direct (format simple)
        product_data->>'nom',
        -- Cas 4: nom_produit direct (format simple)
        product_data->>'nom_produit',
        -- Cas 5: titre (fallback)
        product_data->>'titre',
        -- Cas 6: title (fallback anglais)
        product_data->>'title',
        -- Cas 7: name (fallback anglais)
        product_data->>'name',
        -- Fallback final
        'Produit sans nom'
    )
) STORED;

-- Mettre à jour les produits existants qui pourraient avoir 'Produit sans nom'
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

-- Log pour vérifier les corrections
DO $$
DECLARE
    corrected_count INTEGER;
BEGIN
    GET DIAGNOSTICS corrected_count = ROW_COUNT;
    RAISE NOTICE '[FIX] product_name corrigé pour % produits', corrected_count;
END $$;
