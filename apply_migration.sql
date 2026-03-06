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
