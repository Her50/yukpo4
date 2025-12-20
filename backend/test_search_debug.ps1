# Script PowerShell pour tester la recherche avec les identifiants fournis
# Compare autocomplete vs recherche directe

$env:DATABASE_URL = "postgresql://user:password@host:port/database"
$env:PGPASSWORD = "YOUR_PASSWORD"

Write-Host "=== TEST DE COMPARAISON AUTOCOMPLETE vs RECHERCHE DIRECTE ===" -ForegroundColor Cyan
Write-Host ""

# Test avec le terme "confortables" (d'après les logs)
$searchTerm = "confortables"

Write-Host "Terme de recherche: $searchTerm" -ForegroundColor Yellow
Write-Host ""

# Test 1: Ce que trouve l'autocomplete
Write-Host "=== TEST 1: Résultats AUTOCOMPLETE ===" -ForegroundColor Green
$query1 = @"
SELECT 
    ac.service_id,
    ac.product_id,
    array_length(ac.full_vector, 1) as full_vector_length,
    ac.chosen_location,
    ac.usage_count,
    s.data->'titre_service'->>'valeur' as titre_service
FROM autocomplete_characteristics ac
INNER JOIN services s ON s.id = ac.service_id
WHERE 
    ac.is_real_product = TRUE
    AND s.is_active = TRUE
    AND ac.identifiant_base = 'produits'
    AND (
        EXISTS (
            SELECT 1 FROM unnest(ac.full_vector) AS vec_val
            WHERE LOWER(vec_val) LIKE '%$searchTerm%'
        )
    )
ORDER BY ac.usage_count DESC NULLS LAST
LIMIT 10;
"@

Write-Host "Exécution requête autocomplete..."
psql $env:DATABASE_URL -c $query1

Write-Host ""
Write-Host "=== TEST 2: Résultats RECHERCHE DIRECTE ===" -ForegroundColor Green

# Test 2: Ce que trouve la recherche directe
$query2 = @"
WITH all_products_extracted AS (
    SELECT 
        s.id as service_id,
        s.data,
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END as products_array
    FROM services s
    WHERE s.is_active = true
),
products_extracted AS (
    SELECT DISTINCT
        ape.service_id,
        ape.data,
        ape.products_array
    FROM all_products_extracted ape
    WHERE (
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(ape.products_array) AS product
            WHERE (
                extract_all_product_text(product) ILIKE '%$searchTerm%'
                OR product->>'nom' ILIKE '%$searchTerm%'
                OR product->>'categorie' ILIKE '%$searchTerm%'
                OR product->>'description' ILIKE '%$searchTerm%'
            )
        )
        OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE '%$searchTerm%'
        OR COALESCE(ape.data->>'description', ape.data->'description'->>'valeur', '') ILIKE '%$searchTerm%'
        OR COALESCE(ape.data->>'category', ape.data->'category'->>'valeur', '') ILIKE '%$searchTerm%'
    )
)
SELECT 
    pe.service_id,
    pe.data->'titre_service'->>'valeur' as titre_service,
    jsonb_array_length(pe.products_array) as produits_count
FROM products_extracted pe
LIMIT 10;
"@

Write-Host "Exécution requête recherche directe..."
psql $env:DATABASE_URL -c $query2

Write-Host ""
Write-Host "=== TEST 3: Comparaison des service_id ===" -ForegroundColor Green

$query3 = @"
WITH autocomplete_ids AS (
    SELECT DISTINCT ac.service_id
    FROM autocomplete_characteristics ac
    INNER JOIN services s ON s.id = ac.service_id
    WHERE 
        ac.is_real_product = TRUE
        AND s.is_active = TRUE
        AND ac.identifiant_base = 'produits'
        AND (
            EXISTS (
                SELECT 1 FROM unnest(ac.full_vector) AS vec_val
                WHERE LOWER(vec_val) LIKE '%$searchTerm%'
            )
        )
),
direct_search_ids AS (
    SELECT DISTINCT ape.service_id
    FROM services s,
    LATERAL (
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
            THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    ) AS products_array
    WHERE s.is_active = true
    AND (
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(products_array) AS product
            WHERE (
                extract_all_product_text(product) ILIKE '%$searchTerm%'
                OR product->>'nom' ILIKE '%$searchTerm%'
                OR product->>'categorie' ILIKE '%$searchTerm%'
                OR product->>'description' ILIKE '%$searchTerm%'
            )
        )
        OR COALESCE(s.data->>'titre_service', s.data->'titre_service'->>'valeur', '') ILIKE '%$searchTerm%'
        OR COALESCE(s.data->>'description', s.data->'description'->>'valeur', '') ILIKE '%$searchTerm%'
        OR COALESCE(s.data->>'category', s.data->'category'->>'valeur', '') ILIKE '%$searchTerm%'
    )
)
SELECT 
    'Autocomplete uniquement' as type,
    COUNT(*) as count,
    array_agg(ac.service_id ORDER BY ac.service_id) as service_ids
FROM autocomplete_ids ac
WHERE ac.service_id NOT IN (SELECT service_id FROM direct_search_ids)
UNION ALL
SELECT 
    'Recherche directe uniquement' as type,
    COUNT(*) as count,
    array_agg(ds.service_id ORDER BY ds.service_id) as service_ids
FROM direct_search_ids ds
WHERE ds.service_id NOT IN (SELECT service_id FROM autocomplete_ids)
UNION ALL
SELECT 
    'Dans les deux' as type,
    COUNT(*) as count,
    array_agg(ac.service_id ORDER BY ac.service_id) as service_ids
FROM autocomplete_ids ac
WHERE ac.service_id IN (SELECT service_id FROM direct_search_ids);
"@

Write-Host "Exécution comparaison..."
psql $env:DATABASE_URL -c $query3

Write-Host ""
Write-Host "=== TEST TERMINÉ ===" -ForegroundColor Cyan

