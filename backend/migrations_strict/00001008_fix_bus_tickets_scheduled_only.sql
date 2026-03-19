-- Migration: Correction recherche tickets bus - Filtrer uniquement les voyages programmés
-- Date: 2025-01-07
-- Description: S'assurer que la recherche ne retourne que les voyages avec date >= aujourd'hui

-- ✅ CORRIGÉ: Toujours filtrer les voyages passés (programmés uniquement)
CREATE OR REPLACE FUNCTION search_bus_tickets_with_availability(
    p_departure_city TEXT DEFAULT NULL,
    p_arrival_city TEXT DEFAULT NULL,
    p_departure_date DATE DEFAULT NULL,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50.0,
    p_min_seats INTEGER DEFAULT 1,
    p_agency_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    agency_id INTEGER,
    agency_service_id INTEGER,
    agency_nom VARCHAR,
    agency_adresse TEXT,
    agency_quartier VARCHAR,
    agency_ville VARCHAR,
    agency_gps VARCHAR,
    agency_telephone VARCHAR,
    agency_whatsapp VARCHAR,
    agency_email VARCHAR,
    agency_peut_emettre_tickets BOOLEAN,
    
    -- Informations produit (ticket bus)
    product_id TEXT,
    product_name TEXT,
    product_type TEXT,
    bus_model_name TEXT,
    total_seats INTEGER,
    available_seats INTEGER,
    reserved_seats INTEGER,
    bus_number VARCHAR,
    departure_city TEXT,
    arrival_city TEXT,
    departure_date DATE,
    departure_time TIME,
    ticket_price INTEGER,
    currency VARCHAR,
    bus_configuration JSONB,
    seat_map JSONB,
    
    -- Distance GPS
    distance_km DOUBLE PRECISION,
    
    -- Score de pertinence
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    v_user_point geography;
BEGIN
    -- Créer point GPS utilisateur si fourni
    IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        v_user_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;
    END IF;

    RETURN QUERY
    WITH agency_data AS (
        SELECT 
            av.id,
            av.service_id,
            av.nom,
            av.adresse,
            av.quartier,
            av.ville,
            av.gps,
            av.telephone,
            av.whatsapp,
            av.email,
            av.peut_emettre_tickets_bus,
            av.bus_products_config,
            CASE 
                WHEN v_user_point IS NOT NULL AND av.gps IS NOT NULL AND av.gps != '' THEN
                    calculate_distance_km(
                        p_user_lat,
                        p_user_lng,
                        SPLIT_PART(av.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(av.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS agency_distance_km
        FROM agences_voyage av
        WHERE av.is_active = TRUE
            AND av.peut_emettre_tickets_bus = TRUE
            AND (
                p_agency_name IS NULL OR
                av.nom ILIKE '%' || p_agency_name || '%'
            )
            AND (
                v_user_point IS NULL OR
                av.gps IS NULL OR
                av.gps = '' OR
                ST_DWithin(
                    ST_SetSRID(ST_MakePoint(
                        SPLIT_PART(av.gps, ',', 2)::DOUBLE PRECISION,
                        SPLIT_PART(av.gps, ',', 1)::DOUBLE PRECISION
                    ), 4326)::geography,
                    v_user_point,
                    p_radius_km * 1000
                )
            )
    ),
    product_data AS (
        SELECT 
            p.id::text AS product_id,
            p.name AS product_name,
            p.type AS product_type,
            p.depart AS departure_city,
            p.destination AS arrival_city,
            p.date_depart::date AS departure_date,
            p.date_depart::time AS departure_time,
            p.price AS ticket_price,
            p.currency,
            p.total_seats,
            p.bus_configuration,
            p.seat_map,
            p.numero_bus AS bus_number,
            p.user_id AS product_user_id,
            -- Extraire nom modèle depuis bus_products_config si disponible
            (av.bus_products_config->'modeles_bus'->0->>'nom_modele')::TEXT AS bus_model_name,
            -- Compter places réservées (confirmées ou pending)
            COALESCE(
                (SELECT COUNT(*)::INTEGER
                 FROM bus_reservations br
                 WHERE br.product_id = p.id::text
                   AND br.status IN ('pending', 'confirmed')
                   AND (br.expires_at IS NULL OR br.expires_at > NOW())),
                0
            ) AS reserved_seats,
            -- Calculer places disponibles
            GREATEST(
                0,
                COALESCE(p.total_seats, 0) - 
                COALESCE(
                    (SELECT COUNT(*)::INTEGER
                     FROM bus_reservations br
                     WHERE br.product_id = p.id::text
                       AND br.status IN ('pending', 'confirmed')
                       AND (br.expires_at IS NULL OR br.expires_at > NOW())),
                    0
                )
            ) AS available_seats
        FROM products p
        JOIN services s ON s.id = p.service_id
        JOIN agency_data av ON av.service_id = s.id
        WHERE p.type = 'ticket_voyage'
            AND p.is_active = TRUE
            -- ✅ CORRIGÉ: Toujours filtrer les voyages passés (programmés uniquement)
            AND p.date_depart::date >= CURRENT_DATE
            AND (
                p_departure_city IS NULL OR
                p.depart ILIKE '%' || p_departure_city || '%'
            )
            AND (
                p_arrival_city IS NULL OR
                p.destination ILIKE '%' || p_arrival_city || '%'
            )
            AND (
                p_departure_date IS NULL OR
                p.date_depart::date = p_departure_date
            )
    )
    SELECT 
        ad.id AS agency_id,
        ad.service_id AS agency_service_id,
        ad.nom AS agency_nom,
        ad.adresse AS agency_adresse,
        ad.quartier AS agency_quartier,
        ad.ville AS agency_ville,
        ad.gps AS agency_gps,
        ad.telephone AS agency_telephone,
        ad.whatsapp AS agency_whatsapp,
        ad.email AS agency_email,
        ad.peut_emettre_tickets_bus AS agency_peut_emettre_tickets,
        
        pd.product_id,
        pd.product_name,
        pd.product_type,
        pd.bus_model_name,
        pd.total_seats,
        pd.available_seats,
        pd.reserved_seats,
        pd.bus_number,
        pd.departure_city,
        pd.arrival_city,
        pd.departure_date,
        pd.departure_time,
        pd.ticket_price,
        pd.currency,
        pd.bus_configuration,
        pd.seat_map,
        
        ad.agency_distance_km AS distance_km,
        
        -- Score de pertinence
        (
            CASE WHEN pd.available_seats >= p_min_seats THEN 10 ELSE 0 END +
            CASE WHEN pd.departure_date = CURRENT_DATE THEN 5 ELSE 0 END +
            CASE WHEN pd.departure_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days' THEN 3 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 10 THEN 5 ELSE 0 END +
            CASE WHEN ad.agency_distance_km IS NOT NULL AND ad.agency_distance_km <= 25 THEN 3 ELSE 0 END +
            CASE WHEN p_departure_city IS NOT NULL AND pd.departure_city ILIKE '%' || p_departure_city || '%' THEN 8 ELSE 0 END +
            CASE WHEN p_arrival_city IS NOT NULL AND pd.arrival_city ILIKE '%' || p_arrival_city || '%' THEN 8 ELSE 0 END
        )::DOUBLE PRECISION AS relevance_score
    FROM agency_data ad
    JOIN product_data pd ON pd.product_user_id = ad.id
    WHERE pd.available_seats >= p_min_seats
    ORDER BY 
        relevance_score DESC,
        distance_km ASC NULLS LAST,
        pd.departure_date ASC,
        pd.departure_time ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON FUNCTION search_bus_tickets_with_availability IS 'Recherche tickets bus avec disponibilité en temps réel - Retourne uniquement les voyages programmés (date >= aujourd''hui)';

