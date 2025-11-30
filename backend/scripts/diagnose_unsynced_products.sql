-- Script de diagnostic : Identifier les services avec produits non synchronisés
-- Usage: psql -U postgres -d yukpomnang -f diagnose_unsynced_products.sql

-- 1. Services avec produits non synchronisés
SELECT 
    s.id as service_id,
    s.user_id,
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' THEN 'format_1_array_direct'
        WHEN jsonb_typeof(s.data->'produits') = 'object' 
            AND jsonb_typeof(s.data->'produits'->'valeur') = 'array' THEN 'format_2_object_valeur'
        ELSE 'format_autre'
    END as format_detecte,
    (
        SELECT COUNT(*) 
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits') = 'object' 
                    AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        )
    ) as produits_dans_service,
    (
        SELECT COUNT(*) 
        FROM products_lifecycle pl 
        WHERE pl.service_id = s.id
    ) as produits_synchronises,
    (
        SELECT COUNT(*) 
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits') = 'object' 
                    AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        )
    ) - (
        SELECT COUNT(*) 
        FROM products_lifecycle pl 
        WHERE pl.service_id = s.id
    ) as produits_manquants
FROM services s
WHERE s.is_active = TRUE
    AND (
        jsonb_typeof(s.data->'produits') = 'array'
        OR (
            jsonb_typeof(s.data->'produits') = 'object' 
            AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        )
    )
HAVING (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
            WHEN jsonb_typeof(s.data->'produits') = 'object' 
                AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                THEN s.data->'produits'->'valeur'
            ELSE '[]'::jsonb
        END
    )
) != (
    SELECT COUNT(*) 
    FROM products_lifecycle pl 
    WHERE pl.service_id = s.id
)
ORDER BY produits_manquants DESC, s.id;

-- 2. Statistiques globales
SELECT 
    COUNT(DISTINCT s.id) as total_services_avec_produits,
    COUNT(DISTINCT CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' THEN s.id 
    END) as services_format_1,
    COUNT(DISTINCT CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'object' 
            AND jsonb_typeof(s.data->'produits'->'valeur') = 'array' 
        THEN s.id 
    END) as services_format_2,
    SUM((
        SELECT COUNT(*) 
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits') = 'object' 
                    AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        )
    )) as total_produits_dans_services,
    COUNT(*) as total_produits_synchronises
FROM services s
LEFT JOIN products_lifecycle pl ON pl.service_id = s.id
WHERE s.is_active = TRUE
    AND (
        jsonb_typeof(s.data->'produits') = 'array'
        OR (
            jsonb_typeof(s.data->'produits') = 'object' 
            AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        )
    );

-- 3. Services spécifiques (ex: service 158)
SELECT 
    s.id as service_id,
    jsonb_typeof(s.data->'produits') as produits_type,
    jsonb_typeof(s.data->'produits'->'valeur') as valeur_type,
    (
        SELECT COUNT(*) 
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits') = 'object' 
                    AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        )
    ) as produits_count,
    (
        SELECT COUNT(*) 
        FROM products_lifecycle pl 
        WHERE pl.service_id = s.id
    ) as produits_synchronises,
    s.data->'produits' as produits_raw
FROM services s
WHERE s.id = 158;  -- Remplacer par l'ID du service à diagnostiquer

