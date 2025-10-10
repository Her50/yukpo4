-- Correction de la fonction search_services_gps_final pour correspondre au code Rust
-- Le code Rust attend: service_id, titre_service, category, gps_coords, distance_km, relevance_score, gps_source

CREATE OR REPLACE FUNCTION search_services_gps_final(
    search_query text,
    gps_zone text,
    radius_km integer DEFAULT 50,
    max_results integer DEFAULT 100
)
RETURNS TABLE(
    service_id integer,
    titre_service text,
    category text,
    gps_coords text,
    distance_km double precision,
    relevance_score double precision,
    gps_source text
) AS $$
DECLARE
    gps_parts text[];
    lat double precision;
    lng double precision;
    radius_adjusted double precision;
BEGIN
    -- Ajuster le rayon
    radius_adjusted := calculate_intelligent_radius(radius_km::double precision);
    
    -- Extraire les coordonnées GPS si fournies
    IF gps_zone IS NOT NULL AND gps_zone != '' THEN
        -- Diviser par le séparateur "|" pour gérer les zones polygonales
        gps_parts := string_to_array(gps_zone, '|');
        
        -- Pour l'instant, utiliser le premier point comme centre de recherche
        IF array_length(gps_parts, 1) > 0 THEN
            -- Extraire lat,lng du premier point
            lat := split_part(gps_parts[1], ',', 1)::double precision;
            lng := split_part(gps_parts[1], ',', 2)::double precision;
            
            RAISE NOTICE '[search_services_gps_final] Recherche avec GPS: lat=%, lng=%, rayon=%km', lat, lng, radius_adjusted;
            
            -- Recherche avec filtrage GPS
            RETURN QUERY
            SELECT 
                s.id as service_id,
                COALESCE(s.data->>'titre_service', s.data->>'titre', 'Sans titre') as titre_service,
                COALESCE(s.data->>'category', s.data->>'categorie', 'Non catégorisé') as category,
                extract_gps_from_json(s.data->'gps_fixe') as gps_coords,
                calculate_gps_distance_km(lat, lng, 
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) as distance_km,
                (GREATEST(
                    CASE 
                        WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0
                        WHEN s.data->>'titre' ILIKE '%' || search_query || '%' THEN 100.0
                        WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0
                        ELSE 10.0
                    END,
                    CASE 
                        WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0
                        WHEN s.data->>'categorie' ILIKE '%' || search_query || '%' THEN 30.0
                        ELSE 0.0
                    END
                ))::double precision as relevance_score,
                'gps_fixe' as gps_source
            FROM services s
            WHERE 
                s.actif = true  -- Ne retourner que les services actifs
                AND (
                    s.data->>'titre_service' ILIKE '%' || search_query || '%'
                    OR s.data->>'titre' ILIKE '%' || search_query || '%'
                    OR s.data->>'description' ILIKE '%' || search_query || '%'
                    OR s.data->>'category' ILIKE '%' || search_query || '%'
                    OR s.data->>'categorie' ILIKE '%' || search_query || '%'
                )
                AND s.data->'gps_fixe' IS NOT NULL
                AND extract_gps_from_json(s.data->'gps_fixe') IS NOT NULL
                AND calculate_gps_distance_km(lat, lng,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 1)::double precision,
                    split_part(extract_gps_from_json(s.data->'gps_fixe'), ',', 2)::double precision
                ) <= radius_adjusted
            ORDER BY relevance_score DESC, distance_km ASC
            LIMIT max_results;
            
            RAISE NOTICE '[search_services_gps_final] Recherche GPS terminée';
        END IF;
    END IF;
    
    -- Si pas de GPS, faire une recherche textuelle simple
    RAISE NOTICE '[search_services_gps_final] Recherche sans GPS (fallback)';
    
    RETURN QUERY
    SELECT 
        s.id as service_id,
        COALESCE(s.data->>'titre_service', s.data->>'titre', 'Sans titre') as titre_service,
        COALESCE(s.data->>'category', s.data->>'categorie', 'Non catégorisé') as category,
        extract_gps_from_json(s.data->'gps_fixe') as gps_coords,
        0.0 as distance_km,
        (GREATEST(
            CASE 
                WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 100.0
                WHEN s.data->>'titre' ILIKE '%' || search_query || '%' THEN 100.0
                WHEN s.data->>'description' ILIKE '%' || search_query || '%' THEN 50.0
                ELSE 10.0
            END,
            CASE 
                WHEN s.data->>'category' ILIKE '%' || search_query || '%' THEN 30.0
                WHEN s.data->>'categorie' ILIKE '%' || search_query || '%' THEN 30.0
                ELSE 0.0
            END
        ))::double precision as relevance_score,
        'no_gps' as gps_source
    FROM services s
    WHERE 
        s.actif = true  -- Ne retourner que les services actifs
        AND (
            s.data->>'titre_service' ILIKE '%' || search_query || '%'
            OR s.data->>'titre' ILIKE '%' || search_query || '%'
            OR s.data->>'description' ILIKE '%' || search_query || '%'
            OR s.data->>'category' ILIKE '%' || search_query || '%'
            OR s.data->>'categorie' ILIKE '%' || search_query || '%'
        )
    ORDER BY relevance_score DESC
    LIMIT max_results;
    
    RAISE NOTICE '[search_services_gps_final] Recherche sans GPS terminée';
END;
$$ LANGUAGE plpgsql STABLE;

-- Test de la fonction
SELECT 
    service_id,
    titre_service,
    category,
    gps_coords,
    distance_km,
    relevance_score,
    gps_source
FROM search_services_gps_final('restaurant', '3.8667,11.5167', 50, 10);

-- Afficher le schéma de la fonction pour vérification
SELECT 
    routine_name,
    data_type,
    ordinal_position,
    parameter_name,
    parameter_mode
FROM information_schema.parameters
WHERE specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_name = 'search_services_gps_final' 
    ORDER BY specific_name DESC 
    LIMIT 1
)
ORDER BY ordinal_position;




